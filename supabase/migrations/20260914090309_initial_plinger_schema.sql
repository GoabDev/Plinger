create extension if not exists pgcrypto;

create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  installation_id bigint not null unique,
  account_id bigint,
  account_login text,
  account_type text,
  target_type text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid references public.github_installations(id) on delete cascade,
  github_repository_id bigint not null unique,
  owner_login text not null,
  name text not null,
  full_name text not null unique,
  private boolean not null default false,
  default_branch text,
  archived boolean not null default false,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.repositories(id) on delete cascade,
  github_issue_id bigint not null unique,
  github_issue_number integer not null,
  title text not null,
  state text not null,
  url text,
  assignee_logins text[] not null default '{}',
  labels text[] not null default '{}',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repository_id, github_issue_number)
);

create table public.pull_requests (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.repositories(id) on delete cascade,
  github_pull_request_id bigint not null unique,
  github_pull_request_number integer not null,
  title text not null,
  state text not null,
  url text,
  author_login text,
  head_ref text,
  head_sha text,
  base_ref text,
  base_sha text,
  merged boolean not null default false,
  merged_at timestamptz,
  mergeable boolean,
  mergeable_state text,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (repository_id, github_pull_request_number)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event text not null,
  action text,
  installation_github_id bigint,
  repository_github_id bigint,
  repository_full_name text,
  sender_login text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index github_installations_account_login_idx
  on public.github_installations (account_login);

create index repositories_installation_id_idx
  on public.repositories (installation_id);

create index repositories_owner_login_idx
  on public.repositories (owner_login);

create index issues_repository_id_idx
  on public.issues (repository_id);

create index issues_state_idx
  on public.issues (state);

create index pull_requests_repository_id_idx
  on public.pull_requests (repository_id);

create index pull_requests_state_idx
  on public.pull_requests (state);

create index pull_requests_mergeable_state_idx
  on public.pull_requests (mergeable_state);

create index webhook_events_event_received_at_idx
  on public.webhook_events (event, received_at desc);

create index webhook_events_repository_full_name_idx
  on public.webhook_events (repository_full_name);

create index webhook_events_payload_gin_idx
  on public.webhook_events using gin (payload);

alter table public.github_installations enable row level security;
alter table public.repositories enable row level security;
alter table public.issues enable row level security;
alter table public.pull_requests enable row level security;
alter table public.webhook_events enable row level security;

revoke all on table public.github_installations from anon, authenticated;
revoke all on table public.repositories from anon, authenticated;
revoke all on table public.issues from anon, authenticated;
revoke all on table public.pull_requests from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;

grant select, insert, update, delete on table public.github_installations to service_role;
grant select, insert, update, delete on table public.repositories to service_role;
grant select, insert, update, delete on table public.issues to service_role;
grant select, insert, update, delete on table public.pull_requests to service_role;
grant select, insert, update, delete on table public.webhook_events to service_role;
