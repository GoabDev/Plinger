-- Restore the pre-referral public schema while retaining feature data privately.
-- Keep this forward rollback in migration history; do not replay the removed feature.
do $rollback$
declare
  before_digest text;
  after_digest text;
begin
  perform set_config('lock_timeout', '10s', true);
  perform pg_advisory_xact_lock(771001);
  lock table public.scouter_withdrawal_proofs, public.earning_payments,
    public.referral_audit, public.referrals, public.referral_intents,
    public.referral_codes, public.scouter_members, public.waves in access exclusive mode;

  if exists(select 1 from public.earning_payments where not legacy or reversal_of is not null)
    or exists(select 1 from public.scouter_withdrawal_proofs where wave_id is not null)
    or exists(select 1 from public.referrals) then
    raise exception 'New referral or payment activity exists; reconcile it before rollback';
  end if;
  select md5(coalesce(jsonb_agg(to_jsonb(p)-'wave_id' order by id)::text,''))
    into before_digest from public.scouter_withdrawal_proofs p;

  create schema plinger_referrals_rollback_archive;
  revoke all on schema plinger_referrals_rollback_archive from public, anon, authenticated, service_role;

  drop trigger guard_earning_wave on public.scouter_withdrawal_proofs;
  drop function public.guard_earning_wave();
  drop function public.create_referral_intent(uuid,text);
  drop function public.complete_referral_signup(bigint,text,uuid,timestamptz,uuid,boolean);
  drop function public.manage_wave(uuid,jsonb);
  drop function public.review_referral(uuid,uuid,text,text,bigint,jsonb);
  drop function public.review_earning(uuid,uuid,text);
  drop function public.record_earning_payment(uuid,uuid,jsonb);
  drop function public.correct_earning_wave(uuid,uuid,uuid,text);
  drop view public.scouter_earning_balances;
  drop view public.earning_payment_history;
  alter table public.scouter_withdrawal_proofs drop column wave_id;

  alter table public.waves set schema plinger_referrals_rollback_archive;
  alter table public.scouter_members set schema plinger_referrals_rollback_archive;
  alter table public.referral_codes set schema plinger_referrals_rollback_archive;
  alter table public.referral_intents set schema plinger_referrals_rollback_archive;
  alter table public.referrals set schema plinger_referrals_rollback_archive;
  alter table public.referral_audit set schema plinger_referrals_rollback_archive;
  alter table public.earning_payments set schema plinger_referrals_rollback_archive;
  -- Archived history must not block normal deletion of pre-feature earnings.
  alter table plinger_referrals_rollback_archive.earning_payments drop constraint earning_payments_claim_id_fkey;
  revoke all on all tables in schema plinger_referrals_rollback_archive from public, anon, authenticated, service_role;

  select md5(coalesce(jsonb_agg(to_jsonb(p) order by id)::text,''))
    into after_digest from public.scouter_withdrawal_proofs p;
  if before_digest is distinct from after_digest then
    raise exception 'Existing earnings changed during rollback';
  end if;
end $rollback$;
