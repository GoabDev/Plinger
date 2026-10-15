-- Wave 10 only. No backfill or changes to historical payment snapshots.
create table public.wave10_referral_codes (
  account_id bigint primary key check (account_id > 0),
  code uuid not null unique default gen_random_uuid()
);
create table public.wave10_referrals (
  referee_id bigint primary key check (referee_id > 0),
  referrer_id bigint not null references public.wave10_referral_codes(account_id),
  source text not null check (source in ('link','manual')),
  referred_at timestamptz not null check (referred_at >= '2026-10-15 00:00+01' and referred_at < '2026-10-23 00:00+01'),
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null,
  check (referee_id <> referrer_id)
);
create index wave10_referrals_referrer_idx on public.wave10_referrals(referrer_id);
create table public.wave10_proofs (
  proof_id uuid primary key references public.scouter_withdrawal_proofs(id),
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now()
);
create table public.wave10_bonus_payments (
  proof_id uuid primary key references public.wave10_proofs(proof_id),
  amount_stroops bigint not null check (amount_stroops > 0),
  rate_micros bigint not null check (rate_micros > 0),
  amount_kobo bigint not null check (amount_kobo >= 0),
  rate_source text not null,
  rate_updated_at timestamptz,
  rate_is_fallback boolean not null,
  paid_by uuid not null,
  paid_at timestamptz not null default now()
);
alter table public.wave10_referral_codes enable row level security;
alter table public.wave10_referrals enable row level security;
alter table public.wave10_proofs enable row level security;
alter table public.wave10_bonus_payments enable row level security;
revoke all on public.wave10_referral_codes, public.wave10_referrals, public.wave10_proofs, public.wave10_bonus_payments from public, anon, authenticated;
grant select, insert on public.wave10_referral_codes, public.wave10_referrals, public.wave10_proofs, public.wave10_bonus_payments to service_role;
grant delete on public.wave10_referrals, public.wave10_proofs to service_role;

create function public.wave10_eligible(p_account bigint) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.wave10_referrals r
    join public.scouter_withdrawal_proofs p on p.account_id = r.referee_id
    join public.wave10_proofs w on w.proof_id = p.id
    where r.referrer_id = p_account and p.status = 'confirmed'
      and p.chain_verified_at is not null and p.amount_stroops > 0
  );
$$;

-- Serialize eligibility and payments, including updates through older review endpoints.
create function public.wave10_lock() returns trigger language plpgsql security invoker set search_path = '' as $$
begin perform pg_advisory_xact_lock(771010); return null; end;
$$;
create trigger wave10_proof_lock before update or delete on public.scouter_withdrawal_proofs
for each statement execute function public.wave10_lock();
create trigger wave10_referral_lock before insert or delete on public.wave10_referrals
for each statement execute function public.wave10_lock();
create trigger wave10_tag_lock before insert or delete on public.wave10_proofs
for each statement execute function public.wave10_lock();

create function public.wave10_guard_proof() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.wave10_proofs where proof_id = old.id) then
    if tg_op = 'DELETE' then raise exception 'Remove the Wave 10 assignment first'; end if;
    if new.account_id is distinct from old.account_id or new.amount_stroops is distinct from old.amount_stroops then
      raise exception 'Wave 10 proof ownership and amount are immutable';
    end if;
    if old.payout_status = 'paid' and (
      new.payout_status is distinct from old.payout_status or new.status is distinct from old.status
      or new.payout_scouter_share_stroops is distinct from old.payout_scouter_share_stroops
      or new.payout_amount_kobo is distinct from old.payout_amount_kobo
      or new.payout_exchange_rate_micros is distinct from old.payout_exchange_rate_micros
      or new.paid_at is distinct from old.paid_at or new.paid_by is distinct from old.paid_by
    ) then raise exception 'Recorded Wave 10 payments cannot be cleared'; end if;
    if new.status <> 'confirmed' and exists (
      select 1 from public.wave10_bonus_payments b
      join public.scouter_withdrawal_proofs p on p.id=b.proof_id
      join public.wave10_referrals r on r.referrer_id=p.account_id where r.referee_id=old.account_id
    ) then raise exception 'This proof supports a recorded referral bonus; reconcile it before changing its review'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger wave10_proof_guard before update or delete on public.scouter_withdrawal_proofs
for each row execute function public.wave10_guard_proof();

create function public.wave10_guard_assignment() returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_account bigint;
begin
  if tg_table_name = 'wave10_proofs' then
    select account_id into target_account from public.scouter_withdrawal_proofs where id=old.proof_id;
    if exists(select 1 from public.scouter_withdrawal_proofs where id=old.proof_id and payout_status='paid') then
      raise exception 'Cannot remove Wave 10 from a recorded payment';
    end if;
  else target_account := old.referee_id; end if;
  if exists (
    select 1 from public.wave10_bonus_payments b
    join public.scouter_withdrawal_proofs p on p.id=b.proof_id
    join public.wave10_referrals r on r.referrer_id=p.account_id where r.referee_id=target_account
  ) then raise exception 'This referral supports a recorded bonus; reconcile it before removal'; end if;
  return old;
end;
$$;
create trigger wave10_tag_guard before delete on public.wave10_proofs for each row execute function public.wave10_guard_assignment();
create trigger wave10_referral_guard before delete on public.wave10_referrals for each row execute function public.wave10_guard_assignment();

create function public.wave10_tag_proof(p_id uuid, p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(771010);
  if not exists(select 1 from public.scouter_withdrawal_proofs where id=p_id and status='confirmed' and chain_verified_at is not null and amount_stroops>0) then
    raise exception 'Confirm a chain-verified withdrawal before assigning Wave 10';
  end if;
  insert into public.wave10_proofs(proof_id,confirmed_by) values(p_id,p_actor) on conflict do nothing;
end;
$$;

create function public.wave10_record_payout(p_id uuid, p_actor uuid, p_expected text, p_rate jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  claim public.scouter_withdrawal_proofs;
  base bigint; bonus bigint := 0; due bigint; rate bigint; base_due bigint; bonus_due bigint;
begin
  perform pg_advisory_xact_lock(771010);
  select * into claim from public.scouter_withdrawal_proofs where id=p_id for update;
  if not found or claim.status<>'confirmed' or not exists(select 1 from public.wave10_proofs where proof_id=p_id) then
    raise exception 'A confirmed Wave 10 earning is required';
  end if;
  base := floor(claim.amount_stroops::numeric * 60 / 100);
  if public.wave10_eligible(claim.account_id) then bonus := floor(claim.amount_stroops::numeric * 70 / 100) - base; end if;
  base_due := case when claim.payout_status='paid' then 0 else base end;
  bonus_due := case when exists(select 1 from public.wave10_bonus_payments where proof_id=p_id) then 0 else bonus end;
  due := base_due + bonus_due;
  rate := (p_rate->>'rateMicros')::bigint;
  if due<=0 or due::text<>p_expected or rate<=0 then raise exception 'Payout changed or already paid. Refresh and check the amount.'; end if;
  if base_due>0 then
    update public.scouter_withdrawal_proofs set payout_status='paid',paid_at=now(),paid_by=p_actor,
      payout_scouter_share_stroops=base,payout_exchange_rate_micros=rate,
      payout_amount_kobo=round(base::numeric * rate * 100 / 10000000000000),
      payout_rate_source=p_rate->>'sourceUrl',payout_rate_updated_at=(p_rate->>'updatedAt')::timestamptz,
      payout_rate_is_fallback=(p_rate->>'isFallback')::boolean where id=p_id;
  end if;
  if bonus_due>0 then
    insert into public.wave10_bonus_payments(proof_id,amount_stroops,rate_micros,amount_kobo,rate_source,rate_updated_at,rate_is_fallback,paid_by)
    values(p_id,bonus_due,rate,
      round(due::numeric * rate * 100 / 10000000000000) - round(base_due::numeric * rate * 100 / 10000000000000),
      p_rate->>'sourceUrl',(p_rate->>'updatedAt')::timestamptz,(p_rate->>'isFallback')::boolean,p_actor);
  end if;
end;
$$;
revoke all on function public.wave10_eligible(bigint), public.wave10_lock(), public.wave10_guard_proof(), public.wave10_guard_assignment(), public.wave10_tag_proof(uuid,uuid), public.wave10_record_payout(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.wave10_eligible(bigint), public.wave10_lock(), public.wave10_guard_proof(), public.wave10_guard_assignment(), public.wave10_tag_proof(uuid,uuid), public.wave10_record_payout(uuid,uuid,text,jsonb) to service_role;
