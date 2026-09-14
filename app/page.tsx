import {
  getDashboardData,
  type IssueRow,
  type PullRequestRow,
  type RepositoryRow,
  type WebhookEventRow,
} from "../lib/dashboard/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const latestEvent = data.recentEvents.data[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandRow">
          <img src="/plinger-icon.png" alt="" className="icon" />
          <div>
            <p className="eyebrow">Live GitHub signal board</p>
            <h1>Plinger</h1>
          </div>
        </div>
        <div className="liveBadge">
          <span className={data.hasSupabaseConfig ? "pulse on" : "pulse"} />
          <span>{data.hasSupabaseConfig ? "Connected" : "Waiting for data"}</span>
        </div>
      </header>

      {data.errors.length > 0 ? (
        <section className="notice" aria-label="Dashboard errors">
          <strong>Supabase read failed</strong>
          <span>{data.errors[0]}</span>
        </section>
      ) : null}

      <section className="metricGrid" aria-label="Repository activity summary">
        <Metric
          label="Repositories"
          value={data.repositories.data.length}
          detail="Tracked from GitHub App events"
        />
        <Metric
          label="Open Issues"
          value={data.openIssues.data.length}
          detail="Needs assignment or follow-through"
        />
        <Metric
          label="Open PRs"
          value={data.openPullRequests.data.length}
          detail="Active review and merge flow"
        />
        <Metric
          label="Last Event"
          value={latestEvent?.event ?? "None"}
          detail={latestEvent ? timeAgo(latestEvent.received_at) : "No webhook yet"}
        />
      </section>

      <section className="dashboardGrid">
        <Panel title="Recent Events" meta="Webhook audit trail">
          <EventList events={data.recentEvents.data} />
        </Panel>

        <Panel title="Repositories" meta="Latest connected repos">
          <RepositoryList repositories={data.repositories.data} />
        </Panel>

        <Panel title="Open Issues" meta="Current issue queue">
          <IssueList issues={data.openIssues.data} />
        </Panel>

        <Panel title="Open Pull Requests" meta="Active PR flow">
          <PullRequestList pullRequests={data.openPullRequests.data} />
        </Panel>

        <Panel title="Merged Pull Requests" meta="Recently merged">
          <PullRequestList pullRequests={data.mergedPullRequests.data} merged />
        </Panel>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      {children}
    </section>
  );
}

function EventList({ events }: { events: WebhookEventRow[] }) {
  if (events.length === 0) {
    return <EmptyState label="No webhook events stored yet." />;
  }

  return (
    <div className="list">
      {events.map((event) => (
        <article className="row" key={event.id}>
          <div>
            <div className="rowTitle">
              <span className="tag purple">{event.event}</span>
              {event.action ? <span className="tag">{event.action}</span> : null}
            </div>
            <p>{event.repository_full_name ?? "No repository attached"}</p>
          </div>
          <time>{timeAgo(event.received_at)}</time>
        </article>
      ))}
    </div>
  );
}

function RepositoryList({ repositories }: { repositories: RepositoryRow[] }) {
  if (repositories.length === 0) {
    return <EmptyState label="No repositories captured yet." />;
  }

  return (
    <div className="list">
      {repositories.map((repository) => (
        <article className="row" key={repository.id}>
          <div>
            <h3>{repository.full_name}</h3>
            <p>
              {repository.default_branch ?? "default branch unknown"}
              {repository.private ? " / private" : " / public"}
            </p>
          </div>
          <span className={repository.disabled ? "state muted" : "state"}>
            {repository.disabled ? "Disabled" : "Active"}
          </span>
        </article>
      ))}
    </div>
  );
}

function IssueList({ issues }: { issues: IssueRow[] }) {
  if (issues.length === 0) {
    return <EmptyState label="No open issues captured yet." />;
  }

  return (
    <div className="list">
      {issues.map((issue) => (
        <article className="row" key={issue.id}>
          <div>
            <h3>
              #{issue.github_issue_number} {issue.title}
            </h3>
            <p>{formatAssignees(issue.assignee_logins)}</p>
          </div>
          <span className="state">{issue.state}</span>
        </article>
      ))}
    </div>
  );
}

function PullRequestList({
  pullRequests,
  merged = false,
}: {
  pullRequests: PullRequestRow[];
  merged?: boolean;
}) {
  if (pullRequests.length === 0) {
    return (
      <EmptyState
        label={merged ? "No merged pull requests captured yet." : "No open pull requests captured yet."}
      />
    );
  }

  return (
    <div className="list">
      {pullRequests.map((pullRequest) => (
        <article className="row" key={pullRequest.id}>
          <div>
            <h3>
              #{pullRequest.github_pull_request_number} {pullRequest.title}
            </h3>
            <p>
              {pullRequest.base_ref ?? "base"} ← {pullRequest.head_ref ?? "head"}
            </p>
          </div>
          <span className={pullRequest.merged ? "state purple" : "state"}>
            {pullRequest.merged ? "merged" : pullRequest.mergeable_state ?? pullRequest.state}
          </span>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="empty">{label}</p>;
}

function formatAssignees(assignees: string[]) {
  return assignees.length > 0
    ? assignees.map((name) => `@${name}`).join(", ")
    : "Unassigned";
}

function timeAgo(value: string) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
