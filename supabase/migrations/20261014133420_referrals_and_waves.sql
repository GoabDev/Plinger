-- All mutations are server-authorized. RPCs are SECURITY INVOKER and service-role only.
create table public.waves (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 80),
  status text not null default 'draft' check (status in ('draft','active','settling','closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  qualification_deadline timestamptz,
  timezone text not null default 'Africa/Lagos',
  created_at timestamptz not null default now(),
  check ((starts_at is null and ends_at is null and qualification_deadline is null)
    or (starts_at is not null and ends_at is not null and qualification_deadline is not null
      and starts_at < ends_at and ends_at <= qualification_deadline)),
  check (status in ('draft','closed') or starts_at is not null)
);
create unique index waves_one_active on public.waves ((true)) where status = 'active';
insert into public.waves(name,status) values ('Wave 9','closed'),('Wave 10','draft');
update public.waves set starts_at = '2026-10-15T00:00:00+01:00', ends_at = '2026-10-22T00:00:00+01:00',
  qualification_deadline = '2026-10-29T00:00:00+01:00' where name = 'Wave 10';

create table public.scouter_members (
  account_id bigint primary key check (account_id > 0),
  account_login text not null,
  auth_user_id uuid,
  joined_at timestamptz not null default now(),
  existing_member boolean not null default false
);
create index scouter_members_auth on public.scouter_members(auth_user_id);
-- Identity history survives Auth deletion and GitHub App reinstallation.
insert into public.scouter_members(account_id,account_login,existing_member)
select distinct on (account_id) account_id,account_login,true from (
  select account_id,account_login from public.scouter_profiles
  union all select account_id,account_login from public.github_installations where account_type = 'User'
) s where account_id > 0 and account_login is not null order by account_id
on conflict do nothing;
insert into public.scouter_members(account_id,account_login,auth_user_id,joined_at,existing_member)
select (identity_data->>'sub')::bigint,
  coalesce(identity_data->>'user_name',identity_data->>'preferred_username',identity_data->>'sub'),
  user_id,created_at,true
from auth.identities where provider = 'github' and identity_data->>'sub' ~ '^[0-9]{1,15}$'
on conflict (account_id) do update set auth_user_id = excluded.auth_user_id;

create table public.referral_codes (
  account_id bigint primary key references public.scouter_members(account_id),
  code uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true
);
insert into public.referral_codes(account_id) select account_id from public.scouter_members;
create table public.referral_intents (
  id uuid primary key default gen_random_uuid(),
  code uuid not null references public.referral_codes(code),
  wave_id uuid not null references public.waves(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  bound_user_id uuid,
  bound_account_id bigint,
  visitor_hash text,
  completed_at timestamptz
);
create index referral_intents_wave on public.referral_intents(wave_id);
create index referral_intents_expiry on public.referral_intents(expires_at);
create index referral_intents_visitor on public.referral_intents(visitor_hash,created_at);
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_account_id bigint not null references public.scouter_members(account_id),
  referred_account_id bigint not null unique references public.scouter_members(account_id),
  wave_id uuid not null references public.waves(id),
  status text not null default 'pending' check (status in ('pending','qualified','rejected','revoked','expired')),
  joined_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  reason text,
  evidence jsonb not null default '{}',
  check (referrer_account_id <> referred_account_id),
  check (status <> 'qualified' or (reviewed_by is not null and reviewed_at is not null and length(btrim(reason)) >= 10))
);
create index referrals_wave_status on public.referrals(wave_id,status);
create index referrals_benefit on public.referrals(referrer_account_id,wave_id) where status = 'qualified';
create table public.referral_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  subject_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index referral_audit_subject on public.referral_audit(subject_id,created_at desc);

alter table public.scouter_withdrawal_proofs add column wave_id uuid references public.waves(id);
create index scouter_proofs_wave on public.scouter_withdrawal_proofs(wave_id,account_id);
create table public.earning_payments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.scouter_withdrawal_proofs(id) on delete restrict,
  wave_id uuid references public.waves(id),
  amount_stroops bigint not null check (amount_stroops <> 0),
  amount_kobo bigint,
  rate_micros bigint check (rate_micros > 0),
  rate_source text,
  rate_updated_at timestamptz,
  rate_is_fallback boolean,
  share_percent integer not null check (share_percent in (60,70)),
  gross_stroops bigint not null check (gross_stroops > 0),
  actor_id uuid,
  created_at timestamptz not null default now(),
  reason text not null,
  reversal_of uuid unique references public.earning_payments(id),
  legacy boolean not null default false,
  check ((amount_stroops > 0 and reversal_of is null) or (amount_stroops < 0 and reversal_of is not null)),
  check (legacy or (actor_id is not null and amount_kobo is not null and rate_micros is not null and rate_source is not null))
);
create index earning_payments_claim on public.earning_payments(claim_id,created_at);
create index earning_payments_wave on public.earning_payments(wave_id);
create view public.earning_payment_history with (security_invoker = true) as
select id,claim_id,amount_stroops::text,amount_kobo::text,rate_micros::text,share_percent,created_at,reason,reversal_of,legacy
from public.earning_payments;
insert into public.earning_payments(claim_id,amount_stroops,amount_kobo,rate_micros,rate_source,
  rate_updated_at,rate_is_fallback,share_percent,gross_stroops,actor_id,created_at,reason,legacy)
select id,coalesce(payout_scouter_share_stroops,floor(amount_stroops::numeric*60/100)::bigint),
  payout_amount_kobo,payout_exchange_rate_micros,payout_rate_source,payout_rate_updated_at,
  payout_rate_is_fallback,60,amount_stroops,paid_by,paid_at,'Imported historical payout',true
from public.scouter_withdrawal_proofs where payout_status = 'paid' and amount_stroops > 0;

create view public.scouter_earning_balances with (security_invoker = true) as
select p.id,p.account_id,p.storage_path,p.filename,p.status,p.reviewed_at,p.created_at,p.transaction_hash,p.operation_id,
  p.amount_stroops::text,p.asset_code,p.asset_issuer,p.source_account,p.destination_account,p.ledger,p.transaction_created_at,
  p.chain_verified_at,p.payout_status,p.paid_at,p.payout_scouter_share_stroops::text,p.payout_exchange_rate_micros::text,
  p.payout_amount_kobo::text,p.payout_rate_source,p.payout_rate_updated_at,p.payout_rate_is_fallback,p.wave_id,
  w.name as wave_name, s.share_percent,
  floor(coalesce(p.amount_stroops,0)::numeric*s.share_percent/100)::text as entitlement_stroops,
  coalesce(pay.paid,0)::text as paid_total_stroops,
  coalesce(pay.kobo,0)::text as paid_total_kobo,
  (case when p.status = 'confirmed' then floor(coalesce(p.amount_stroops,0)::numeric*s.share_percent/100) else 0 end
    - coalesce(pay.paid,0))::text as balance_stroops,
  coalesce(pay.unknown_naira,false) as unknown_legacy_naira
from public.scouter_withdrawal_proofs p
left join public.waves w on w.id = p.wave_id
cross join lateral (select case when exists (
  select 1 from public.referrals r where r.referrer_account_id = p.account_id
    and r.wave_id = p.wave_id and r.status = 'qualified') then 70 else 60 end as share_percent) s
left join lateral (select sum(amount_stroops) as paid,sum(amount_kobo) as kobo,
  bool_or(amount_kobo is null and not exists (select 1 from public.earning_payments rev where rev.reversal_of = ep.id)) as unknown_naira
  from public.earning_payments ep where ep.claim_id = p.id) pay on true;

-- Prevent changes to settled amounts and require a real wave for new submissions.
create function public.guard_earning_wave() returns trigger language plpgsql security invoker set search_path = '' as $$
declare w public.waves;
begin
  if TG_OP = 'UPDATE' then
    if new.payout_status is distinct from old.payout_status or new.paid_at is distinct from old.paid_at
      or new.paid_by is distinct from old.paid_by or new.payout_scouter_share_stroops is distinct from old.payout_scouter_share_stroops
      or new.payout_amount_kobo is distinct from old.payout_amount_kobo or new.payout_exchange_rate_micros is distinct from old.payout_exchange_rate_micros then
      raise exception 'Use the payment ledger to record payments and corrections';
    end if;
    if (new.wave_id is distinct from old.wave_id and current_setting('plinger.wave_correction',true) is distinct from 'allowed') or new.amount_stroops is distinct from old.amount_stroops
      or new.account_id <> old.account_id then
      raise exception 'Earning identity, amount and wave cannot be changed';
    end if;
    return new;
  end if;
  select * into w from public.waves where id = new.wave_id for share;
  if w.id is null or w.status not in ('active','settling') or now() < w.starts_at or now() >= w.qualification_deadline then
    raise exception 'Choose a wave that is accepting earnings';
  end if;
  return new;
end $$;
create trigger guard_earning_wave before insert or update on public.scouter_withdrawal_proofs
for each row execute function public.guard_earning_wave();

create function public.create_referral_intent(p_code uuid,p_visitor text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare active_wave uuid; intent_id uuid;
begin
  perform pg_advisory_xact_lock(771001);
  if (select count(*) from public.referral_intents where visitor_hash = p_visitor and created_at > now()-interval '1 hour') >= 20 then
    raise exception 'Too many signup attempts. Please try again later';
  end if;
  if not exists(select 1 from public.referral_codes where code = p_code and enabled) then raise exception 'Referral unavailable'; end if;
  select id into active_wave from public.waves where status = 'active' and starts_at <= now() and ends_at > now();
  if active_wave is null then raise exception 'No wave is accepting referrals'; end if;
  insert into public.referral_intents(code,wave_id,visitor_hash) values(p_code,active_wave,p_visitor) returning id into intent_id;
  return intent_id;
end $$;

create function public.complete_referral_signup(p_account bigint,p_login text,p_user uuid,p_created timestamptz,p_intent uuid default null,p_retry boolean default false)
returns text language plpgsql security invoker set search_path = '' as $$
declare i public.referral_intents; w public.waves; referrer bigint; old_member public.scouter_members; auth_created timestamptz;
begin
  perform pg_advisory_xact_lock(771001);
  select * into old_member from public.scouter_members where account_id = p_account;
  if old_member.account_id is not null then
    update public.scouter_members set account_login = p_login,auth_user_id = p_user where account_id = p_account;
    insert into public.referral_codes(account_id) values(p_account) on conflict do nothing;
    if p_intent is not null and not exists(select 1 from public.referral_intents where id = p_intent and bound_user_id = p_user and bound_account_id = p_account and completed_at is not null) then
      return 'existing';
    end if;
    return 'complete';
  end if;
  if p_intent is not null then
    select * into i from public.referral_intents where id = p_intent for update;
    if i.id is null or (i.expires_at <= now() and not p_retry) or i.created_at < now()-interval '7 days'
      or (i.bound_user_id is not null and i.bound_user_id <> p_user) then
      return 'expired';
    end if;
    select * into w from public.waves where id = i.wave_id;
    if w.status <> 'active' or now() < w.starts_at or now() >= w.ends_at then return 'wave_changed'; end if;
    select account_id into referrer from public.referral_codes where code = i.code and enabled;
    if referrer is null or referrer = p_account then return 'invalid'; end if;
    auth_created := p_created;
    if auth_created is null or auth_created < i.created_at - interval '5 minutes' then return 'existing'; end if;
  end if;
  insert into public.scouter_members(account_id,account_login,auth_user_id) values(p_account,p_login,p_user);
  insert into public.referral_codes(account_id) values(p_account);
  if p_intent is not null then
    insert into public.referrals(referrer_account_id,referred_account_id,wave_id) values(referrer,p_account,i.wave_id);
    update public.referral_intents set bound_user_id = p_user,bound_account_id = p_account,completed_at = now() where id = i.id;
  end if;
  return 'complete';
end $$;

create function public.manage_wave(p_actor uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare w public.waves; target uuid; next_status text;
begin
  perform pg_advisory_xact_lock(771001);
  target := nullif(p_data->>'id','')::uuid;
  if target is null then
    insert into public.waves(name) values(btrim(p_data->>'name')) returning id into target;
  else
    select * into w from public.waves where id = target for update;
    if not found then raise exception 'Wave not found'; end if;
    next_status := coalesce(p_data->>'status',w.status);
    if p_data->>'operation' = 'extend' then
      if w.status not in ('active','settling') or (p_data->>'ends_at')::timestamptz < w.ends_at
        or (p_data->>'qualification_deadline')::timestamptz < w.qualification_deadline then
        raise exception 'An active or settling wave can only be extended';
      end if;
      update public.waves set ends_at = (p_data->>'ends_at')::timestamptz,
        qualification_deadline = (p_data->>'qualification_deadline')::timestamptz where id = target;
    elsif w.status = 'draft' then
      if next_status not in ('draft','active') then raise exception 'Activate a draft before settling it'; end if;
      if not exists(select 1 from pg_timezone_names where name = p_data->>'timezone') then raise exception 'Invalid timezone'; end if;
      update public.waves set name = btrim(p_data->>'name'), starts_at = (p_data->>'starts_at')::timestamptz,
        ends_at = (p_data->>'ends_at')::timestamptz, qualification_deadline = (p_data->>'qualification_deadline')::timestamptz,
        timezone = p_data->>'timezone',status = next_status where id = target;
    else
      if not ((w.status = 'active' and next_status = 'settling') or (w.status = 'settling' and next_status = 'closed')) then
        raise exception 'Wave dates are locked; move active waves to settling, then closed';
      end if;
      if next_status = 'closed' then
        if exists(select 1 from public.scouter_withdrawal_proofs where wave_id = target and status = 'pending') then
          raise exception 'Review pending earnings before closing the wave';
        end if;
        if exists(select 1 from public.referrals where wave_id = target and status = 'pending') then
          raise exception 'Review pending referrals before closing the wave';
        end if;
      end if;
      update public.waves set status = next_status where id = target;
    end if;
  end if;
  select * into w from public.waves where id = target;
  if w.status <> 'draft' and exists(select 1 from public.waves other where other.id <> w.id and other.status <> 'draft'
    and other.starts_at < w.ends_at and other.ends_at > w.starts_at) then
    raise exception 'Activity dates overlap another wave';
  end if;
  insert into public.referral_audit(actor_id,action,subject_id,details) values(p_actor,'wave.updated',target,p_data);
  return target;
end $$;

create function public.review_referral(p_actor uuid,p_id uuid,p_status text,p_reason text,p_issue bigint default null,p_evidence jsonb default '{}')
returns void language plpgsql security invoker set search_path = '' as $$
declare r public.referrals; w public.waves;
begin
  perform pg_advisory_xact_lock(771001);
  select * into r from public.referrals where id = p_id for update;
  if not found then raise exception 'Referral not found'; end if;
  select * into w from public.waves where id = r.wave_id;
  if w.status = 'closed' then raise exception 'This wave is closed'; end if;
  if p_status not in ('qualified','rejected','revoked') or length(btrim(p_reason)) < 10 then raise exception 'A review decision and detailed reason are required'; end if;
  if p_status = 'qualified' then
    if w.status not in ('active','settling') or now() >= w.qualification_deadline then raise exception 'The qualification deadline has passed'; end if;
    if not exists(select 1 from public.issues i join public.issue_assignments a on a.issue_id = i.id
      where i.github_issue_id = p_issue and a.assignee_account_id = r.referred_account_id
        and i.state = 'closed' and i.closed_at >= greatest(w.starts_at,r.joined_at) and i.closed_at < w.ends_at) then
      raise exception 'Select an assigned issue completed in this wave after signup';
    end if;
    if not exists(select 1 from public.github_installations where account_id = r.referred_account_id
      and account_type = 'User' and uninstalled_at is null and suspended_at is null) then
      raise exception 'The referred Scouter needs an active personal GitHub App installation';
    end if;
    if p_evidence->>'contributionVerified' is distinct from 'true' then raise exception 'Verify the Scouter actually completed the work'; end if;
  end if;
  update public.referrals set status = p_status,reason = btrim(p_reason),reviewed_at = now(),reviewed_by = p_actor,
    evidence = p_evidence || jsonb_build_object('issueId',p_issue,'policy','completed-work-admin-v1') where id = p_id;
  insert into public.referral_audit(actor_id,action,subject_id,details)
  values(p_actor,'referral.reviewed',p_id,jsonb_build_object('from',r.status,'to',p_status,'reason',p_reason,'evidence',p_evidence,'issueId',p_issue));
end $$;

create function public.review_earning(p_actor uuid,p_id uuid,p_status text) returns void
language plpgsql security invoker set search_path = '' as $$
declare c public.scouter_withdrawal_proofs;
begin
  perform pg_advisory_xact_lock(771001);
  select * into c from public.scouter_withdrawal_proofs where id = p_id for update;
  if not found then raise exception 'Earning not found'; end if;
  if p_status not in ('pending','confirmed','rejected') then raise exception 'Invalid review status'; end if;
  if exists(select 1 from public.waves where id = c.wave_id and status = 'closed') then raise exception 'This wave is closed'; end if;
  if c.status <> p_status and exists(select 1 from public.earning_payments where claim_id = p_id) then
    raise exception 'An earning with payment history cannot be reclassified; record a payment correction instead';
  end if;
  update public.scouter_withdrawal_proofs set status = p_status, reviewed_at = now(), reviewed_by = p_actor where id = p_id;
  insert into public.referral_audit(actor_id,action,subject_id,details)
    values(p_actor,'earning.reviewed',p_id,jsonb_build_object('from',c.status,'to',p_status));
end $$;

create function public.record_earning_payment(p_actor uuid,p_id uuid,p_data jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c public.scouter_earning_balances; prev public.earning_payments; existing public.earning_payments;
  payment_id uuid; rate bigint; amount bigint; kobo bigint;
begin
  perform pg_advisory_xact_lock(771001);
  payment_id := (p_data->>'requestId')::uuid;
  select * into existing from public.earning_payments where id = payment_id;
  if found then
    if existing.claim_id <> p_id or existing.actor_id <> p_actor then raise exception 'Payment request conflict'; end if;
    return payment_id;
  end if;
  select * into c from public.scouter_earning_balances where id = p_id;
  if not found then raise exception 'Earning not found'; end if;
  if p_data->>'action' = 'reverse' then
    select * into prev from public.earning_payments where id = (p_data->>'paymentId')::uuid and claim_id = p_id;
    if prev.id is null or prev.reversal_of is not null or exists(select 1 from public.earning_payments where reversal_of = prev.id) then raise exception 'Payment is already reversed or unavailable'; end if;
    if length(btrim(p_data->>'reason')) < 10 then raise exception 'Explain the payment correction'; end if;
    insert into public.earning_payments(id,claim_id,wave_id,amount_stroops,amount_kobo,rate_micros,rate_source,
      rate_updated_at,rate_is_fallback,share_percent,gross_stroops,actor_id,reason,reversal_of,legacy)
    values(payment_id,p_id,prev.wave_id,-prev.amount_stroops,-prev.amount_kobo,prev.rate_micros,prev.rate_source,
      prev.rate_updated_at,prev.rate_is_fallback,prev.share_percent,prev.gross_stroops,p_actor,p_data->>'reason',prev.id,prev.legacy);
  else
    amount := c.balance_stroops::bigint;
    rate := (p_data->>'rateMicros')::bigint;
    if c.status <> 'confirmed' or amount <= 0 then raise exception 'No confirmed balance is due'; end if;
    if amount::text is distinct from p_data->>'expectedBalance' or c.share_percent::text is distinct from p_data->>'expectedPercent' then
      raise exception 'The earning changed; refresh and confirm the new balance';
    end if;
    if rate is null or rate <= 0 then raise exception 'Invalid exchange rate'; end if;
    kobo := floor((amount::numeric*rate*100 + 5000000000000)/10000000000000)::bigint;
    insert into public.earning_payments(id,claim_id,wave_id,amount_stroops,amount_kobo,rate_micros,rate_source,
      rate_updated_at,rate_is_fallback,share_percent,gross_stroops,actor_id,reason)
    values(payment_id,p_id,c.wave_id,amount,kobo,rate,p_data->>'rateSource',(p_data->>'rateUpdatedAt')::timestamptz,
      (p_data->>'rateIsFallback')::boolean,c.share_percent,c.amount_stroops::bigint,p_actor,'Recorded payout of outstanding balance');
  end if;
  insert into public.referral_audit(actor_id,action,subject_id,details) values(p_actor,'earning.payment',p_id,jsonb_build_object('paymentId',payment_id,'action',p_data->>'action'));
  return payment_id;
end $$;

create function public.correct_earning_wave(p_actor uuid,p_id uuid,p_wave uuid,p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
declare c public.scouter_withdrawal_proofs;
begin
  perform pg_advisory_xact_lock(771001);
  select * into c from public.scouter_withdrawal_proofs where id = p_id for update;
  if c.id is null then raise exception 'Earning not found'; end if;
  if c.status = 'confirmed' or exists(select 1 from public.earning_payments where claim_id = p_id) then
    raise exception 'Only unapproved earnings without payment history can change wave';
  end if;
  if exists(select 1 from public.waves where id = c.wave_id and status = 'closed') then raise exception 'The original wave is closed'; end if;
  if not exists(select 1 from public.waves where id = p_wave and status in ('active','settling') and starts_at <= now() and qualification_deadline > now()) then
    raise exception 'The target wave is not accepting earnings';
  end if;
  if length(btrim(p_reason)) < 10 then raise exception 'Explain the wave correction'; end if;
  perform set_config('plinger.wave_correction','allowed',true);
  update public.scouter_withdrawal_proofs set wave_id = p_wave,status = 'pending',reviewed_at = null,reviewed_by = null where id = p_id;
  perform set_config('plinger.wave_correction','',true);
  insert into public.referral_audit(actor_id,action,subject_id,details) values(p_actor,'earning.wave_corrected',p_id,
    jsonb_build_object('from',c.wave_id,'to',p_wave,'reason',p_reason));
end $$;

-- Restrict the whole feature to server-mediated, authenticated routes.
do $$ declare t text; f record; begin
  foreach t in array array['waves','scouter_members','referral_codes','referral_intents','referrals','referral_audit','earning_payments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update on public.%I to service_role',t);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('guard_earning_wave','create_referral_intent','complete_referral_signup','manage_wave','review_referral','review_earning','record_earning_payment','correct_earning_wave') loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
revoke update on public.earning_payments,public.referral_audit from service_role;
revoke all on public.scouter_earning_balances from public,anon,authenticated;
grant select on public.scouter_earning_balances to service_role;
revoke all on public.earning_payment_history from public,anon,authenticated;
grant select on public.earning_payment_history to service_role;
