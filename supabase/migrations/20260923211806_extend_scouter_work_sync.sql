alter table public.scouter_issue_sync_state
  add column phase text not null default 'issues'
    check (phase in ('issues', 'pull_requests')),
  add column issue_status text not null default 'pending'
    check (issue_status in ('pending', 'syncing', 'complete', 'failed')),
  add column pull_request_status text not null default 'pending'
    check (pull_request_status in ('pending', 'syncing', 'complete', 'failed')),
  add column pull_request_pages_checked integer not null default 0
    check (pull_request_pages_checked >= 0),
  add column pull_requests_seen integer not null default 0
    check (pull_requests_seen >= 0),
  add column links_seen integer not null default 0
    check (links_seen >= 0),
  add column issue_last_error text,
  add column pull_request_last_error text;

comment on column public.scouter_issue_sync_state.pages_checked is
  'Assigned issue search pages checked in the current or most recent run.';
comment on column public.scouter_issue_sync_state.issues_seen is
  'Assigned issues seen in the current or most recent run.';
comment on column public.scouter_issue_sync_state.pull_request_pages_checked is
  'Authored pull request search pages checked in the current or most recent run.';
comment on column public.scouter_issue_sync_state.pull_requests_seen is
  'Authored pull requests seen in the current or most recent run.';
comment on column public.scouter_issue_sync_state.links_seen is
  'Issue-to-pull-request relationships seen in the current or most recent run.';

update public.scouter_issue_sync_state
set
  status = 'stale',
  phase = 'issues',
  sync_run_id = null,
  next_page = 1,
  pages_checked = 0,
  issues_seen = 0,
  issue_status = 'pending',
  pull_request_status = 'pending',
  pull_request_pages_checked = 0,
  pull_requests_seen = 0,
  links_seen = 0,
  last_error = null,
  issue_last_error = null,
  pull_request_last_error = null,
  updated_at = now();
