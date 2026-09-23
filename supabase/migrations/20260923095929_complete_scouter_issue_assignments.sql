create table public.issue_assignments (
  issue_id uuid not null references public.issues(id) on delete cascade,
  assignee_account_id bigint not null,
  assignee_login text not null,
  active boolean not null default true,
  first_assigned_at timestamptz,
  last_assigned_at timestamptz,
  unassigned_at timestamptz,
  last_seen_at timestamptz not null default now(),
  last_seen_sync_id uuid not null default gen_random_uuid(),
  missed_complete_syncs integer not null default 0 check (missed_complete_syncs >= 0),
  source text not null default 'stored_snapshot'
    check (source in ('stored_snapshot', 'github_app', 'scouter_token', 'webhook')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (issue_id, assignee_account_id)
);

create table public.scouter_issue_sync_state (
  account_id bigint primary key,
  account_login text not null,
  status text not null default 'pending'
    check (status in ('pending', 'syncing', 'complete', 'stale', 'token_required', 'failed')),
  coverage text not null default 'app_repositories_only'
    check (coverage in ('app_repositories_only', 'all_visible_repositories')),
  sync_run_id uuid,
  next_page integer not null default 1 check (next_page > 0),
  pages_checked integer not null default 0 check (pages_checked >= 0),
  issues_seen integer not null default 0 check (issues_seen >= 0),
  started_at timestamptz,
  last_completed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

create table public.issue_assignment_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  assignee_account_id bigint not null,
  assignee_login text not null,
  action text not null check (action in ('assigned', 'unassigned')),
  occurred_at timestamptz not null,
  source text not null default 'webhook' check (source in ('webhook', 'timeline_backfill')),
  created_at timestamptz not null default now(),
  unique (issue_id, assignee_account_id, action, occurred_at)
);

create index issue_assignments_scouter_active_idx
  on public.issue_assignments (assignee_account_id, active, updated_at desc);

create index issue_assignments_issue_active_idx
  on public.issue_assignments (issue_id, active);

create index scouter_issue_sync_state_schedule_idx
  on public.scouter_issue_sync_state (status, last_completed_at nulls first, updated_at);

create index issue_assignment_events_scouter_occurred_idx
  on public.issue_assignment_events (assignee_account_id, occurred_at desc);

alter table public.issue_assignments enable row level security;
alter table public.scouter_issue_sync_state enable row level security;
alter table public.issue_assignment_events enable row level security;

revoke all on table public.issue_assignments from anon, authenticated;
revoke all on table public.scouter_issue_sync_state from anon, authenticated;
revoke all on table public.issue_assignment_events from anon, authenticated;
grant select, insert, update, delete on table public.issue_assignments to service_role;
grant select, insert, update, delete on table public.scouter_issue_sync_state to service_role;
grant select, insert, update, delete on table public.issue_assignment_events to service_role;

with scouters as (
  select distinct on (account_id)
    account_id,
    account_login
  from public.github_installations
  where account_id is not null
    and account_login is not null
  order by account_id, uninstalled_at nulls first, updated_at desc
)
insert into public.issue_assignments (
  issue_id,
  assignee_account_id,
  assignee_login,
  active,
  first_assigned_at,
  last_assigned_at,
  last_seen_at,
  source
)
select
  issue.id,
  scouter.account_id,
  scouter.account_login,
  true,
  null,
  null,
  issue.updated_at,
  'stored_snapshot'
from public.issues as issue
join scouters as scouter
  on exists (
   select 1
   from unnest(issue.assignee_logins) as assignee(login)
   where lower(assignee.login) = lower(scouter.account_login)
 )
on conflict (issue_id, assignee_account_id) do update
set
  assignee_login = excluded.assignee_login,
  active = true,
  unassigned_at = null,
  last_seen_at = greatest(public.issue_assignments.last_seen_at, excluded.last_seen_at),
  updated_at = now();

create view public.scouter_current_issues
with (security_invoker = true)
as
select
  assignment.assignee_account_id,
  assignment.assignee_login,
  assignment.first_assigned_at,
  assignment.last_seen_at as assignment_last_seen_at,
  assignment.source as assignment_source,
  issue.id,
  issue.github_issue_id,
  issue.github_issue_number,
  issue.title,
  issue.state,
  issue.url,
  issue.assignee_logins,
  issue.labels,
  issue.opened_at,
  issue.closed_at,
  issue.updated_at
from public.issue_assignments as assignment
join public.issues as issue on issue.id = assignment.issue_id
where assignment.active;

revoke all on table public.scouter_current_issues from anon, authenticated;
grant select on table public.scouter_current_issues to service_role;
