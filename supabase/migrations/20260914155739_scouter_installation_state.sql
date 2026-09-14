alter table public.github_installations
  add column uninstalled_at timestamptz;

with latest_installation_event as (
  select distinct on (installation_github_id)
    installation_github_id,
    action,
    received_at
  from public.webhook_events
  where event = 'installation'
    and action in ('created', 'deleted')
    and installation_github_id is not null
  order by installation_github_id, received_at desc
)
update public.github_installations as installation
set uninstalled_at = event.received_at
from latest_installation_event as event
where installation.installation_id = event.installation_github_id
  and event.action = 'deleted';

create index issues_assignee_logins_idx
  on public.issues using gin (assignee_logins);

create index pull_requests_author_state_idx
  on public.pull_requests (author_login, state);

create index webhook_events_sender_received_at_idx
  on public.webhook_events (sender_login, received_at desc);
