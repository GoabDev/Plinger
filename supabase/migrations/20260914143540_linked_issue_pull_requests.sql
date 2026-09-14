create table public.issue_pull_requests (
  github_issue_id bigint not null references public.issues(github_issue_id) on delete cascade,
  github_pull_request_id bigint not null references public.pull_requests(github_pull_request_id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (github_issue_id, github_pull_request_id)
);

create index issue_pull_requests_pull_request_idx
  on public.issue_pull_requests (github_pull_request_id);

alter table public.issue_pull_requests enable row level security;
revoke all on table public.issue_pull_requests from anon, authenticated;
grant select, insert, update, delete on table public.issue_pull_requests to service_role;
