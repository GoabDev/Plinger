create table public.scouter_profiles (
  account_id bigint primary key,
  account_login text not null,
  pat_ciphertext text,
  pat_updated_at timestamptz,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  bank_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scouter_withdrawal_proofs (
  id uuid primary key default gen_random_uuid(),
  account_id bigint not null references public.scouter_profiles(account_id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index scouter_withdrawal_proofs_account_created_idx
  on public.scouter_withdrawal_proofs(account_id, created_at desc);

create table public.scouter_pat_access_log (
  id uuid primary key default gen_random_uuid(),
  account_id bigint not null references public.scouter_profiles(account_id) on delete cascade,
  admin_user_id uuid not null,
  accessed_at timestamptz not null default now()
);
create index scouter_pat_access_log_account_idx on public.scouter_pat_access_log(account_id, accessed_at desc);

alter table public.scouter_profiles enable row level security;
alter table public.scouter_withdrawal_proofs enable row level security;
alter table public.scouter_pat_access_log enable row level security;
revoke all on table public.scouter_profiles from anon, authenticated;
revoke all on table public.scouter_withdrawal_proofs from anon, authenticated;
revoke all on table public.scouter_pat_access_log from anon, authenticated;
grant select, insert, update, delete on table public.scouter_profiles to service_role;
grant select, insert, update, delete on table public.scouter_withdrawal_proofs to service_role;
grant select, insert on table public.scouter_pat_access_log to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('scouter-withdrawal-proofs', 'scouter-withdrawal-proofs', false, 10485760, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;
