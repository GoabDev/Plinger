alter table public.scouter_withdrawal_proofs
  add column transaction_hash text,
  add column operation_id text,
  add column amount_stroops bigint,
  add column asset_code text,
  add column asset_issuer text,
  add column source_account text,
  add column destination_account text,
  add column ledger bigint,
  add column transaction_created_at timestamptz,
  add column chain_verified_at timestamptz,
  add column verification_error text,
  add column reviewed_by uuid,
  add column payout_status text not null default 'unpaid',
  add column paid_at timestamptz,
  add column paid_by uuid;

alter table public.scouter_withdrawal_proofs
  add constraint scouter_withdrawal_proofs_transaction_hash_key unique (transaction_hash),
  add constraint scouter_withdrawal_proofs_operation_id_key unique (operation_id),
  add constraint scouter_withdrawal_proofs_amount_positive check (amount_stroops is null or amount_stroops > 0),
  add constraint scouter_withdrawal_proofs_payout_status_check check (payout_status in ('unpaid', 'paid')),
  add constraint scouter_withdrawal_proofs_paid_state_check check (
    (payout_status = 'unpaid' and paid_at is null and paid_by is null)
    or
    (payout_status = 'paid' and status = 'confirmed' and paid_at is not null and paid_by is not null)
  );

create index scouter_withdrawal_proofs_status_created_idx
  on public.scouter_withdrawal_proofs(status, created_at desc);

create index scouter_withdrawal_proofs_payout_created_idx
  on public.scouter_withdrawal_proofs(payout_status, created_at desc)
  where status = 'confirmed';
