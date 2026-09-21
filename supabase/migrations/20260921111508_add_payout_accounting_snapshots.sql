alter table public.scouter_withdrawal_proofs
  add column payout_scouter_share_stroops bigint,
  add column payout_exchange_rate_micros bigint,
  add column payout_amount_kobo bigint,
  add column payout_rate_source text,
  add column payout_rate_updated_at timestamptz,
  add column payout_rate_is_fallback boolean;

alter table public.scouter_withdrawal_proofs
  add constraint scouter_withdrawal_proofs_payout_snapshot_values_check check (
    (
      payout_scouter_share_stroops is null
      and payout_exchange_rate_micros is null
      and payout_amount_kobo is null
      and payout_rate_source is null
      and payout_rate_updated_at is null
      and payout_rate_is_fallback is null
    )
    or
    (
      payout_scouter_share_stroops > 0
      and payout_exchange_rate_micros > 0
      and payout_amount_kobo > 0
      and length(btrim(payout_rate_source)) > 0
      and payout_rate_is_fallback is not null
    )
  ),
  add constraint scouter_withdrawal_proofs_unpaid_snapshot_empty_check check (
    payout_status = 'paid'
    or (
      payout_scouter_share_stroops is null
      and payout_exchange_rate_micros is null
      and payout_amount_kobo is null
      and payout_rate_source is null
      and payout_rate_updated_at is null
      and payout_rate_is_fallback is null
    )
  );

comment on column public.scouter_withdrawal_proofs.payout_scouter_share_stroops is
  'Immutable USD-denominated scouter share captured when the payout is marked paid.';
comment on column public.scouter_withdrawal_proofs.payout_exchange_rate_micros is
  'USD/NGN rate used for this payout, stored as NGN per USD multiplied by 1,000,000.';
comment on column public.scouter_withdrawal_proofs.payout_amount_kobo is
  'Exact naira payout amount captured in kobo when the payout is marked paid.';
