alter table public.scouter_issue_sync_state
  add column recent_status text not null default 'pending'
    check (recent_status in ('pending', 'complete', 'failed')),
  add column recent_last_completed_at timestamptz,
  add column recent_last_error text;

comment on column public.scouter_issue_sync_state.recent_last_completed_at is
  'Successful recent-work checkpoint; advanced only after both searches and all writes succeed.';
