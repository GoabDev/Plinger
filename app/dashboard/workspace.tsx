"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleDot,
  ExternalLink,
  CodeXml as Github,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Inbox,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  X,
  Users,
  type LucideIcon,
} from "lucide-react";
import type {
  IssueRow,
  IssuePullRequestRow,
  PullRequestRow,
  RepositoryRow,
  WebhookEventRow,
} from "../../lib/dashboard/data";
import { prStatus } from "../../lib/dashboard/status";
import type { ScouterRow } from "../../lib/dashboard/scouters";
import ScoutersView from "./scouters-view";
import { Brand } from "../ui/brand";
import { signOut } from "../login/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type View =
  | "overview"
  | "activity"
  | "repositories"
  | "issues"
  | "closed-issues"
  | "pull-requests"
  | "merged"
  | "scouters";
type Props = {
  repositories: RepositoryRow[];
  issues: IssueRow[];
  closedIssues: IssueRow[];
  pullRequests: PullRequestRow[];
  merged: PullRequestRow[];
  links: IssuePullRequestRow[];
  events: WebhookEventRow[];
  scouters: ScouterRow[];
  scouterCount: number;
  scoutersUnavailable: boolean;
  scouterHistoryUnavailable: boolean;
  connected: boolean;
  failed: boolean;
  fetchedAt: number;
};
const navigation: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "repositories", label: "Repositories", icon: BookOpen },
  { id: "scouters", label: "Scouters", icon: Users },
  { id: "issues", label: "Open issues", icon: CircleDot },
  { id: "closed-issues", label: "Closed issues", icon: Check },
  { id: "pull-requests", label: "Pull requests", icon: GitPullRequest },
  { id: "merged", label: "Merged", icon: GitMerge },
];
const subtitles: Record<View, string> = {
  overview: "A little clarity on everything moving across your repositories.",
  activity: "The latest updates from your connected repositories.",
  repositories: "Your recently updated repositories, together in one place.",
  scouters: "Personal GitHub accounts connected to Plinger and their work.",
  issues: "Open work, assignments, and the details that matter.",
  "closed-issues": "Recently closed issues across your repositories.",
  "pull-requests":
    "Follow active changes from the first commit to the final review.",
  merged: "A record of work that made it across the finish line.",
};

export default function DashboardWorkspace({
  repositories,
  issues,
  closedIssues,
  pullRequests,
  merged,
  links,
  events,
  scouters,
  scouterCount,
  scoutersUnavailable,
  scouterHistoryUnavailable,
  connected,
  failed,
  fetchedAt,
}: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("all");
  const [repository, setRepository] = useState("all");
  const [queue, setQueue] = useState<"issues" | "pull-requests" | "merged">(
    "issues",
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncFailed, setSyncFailed] = useState(false);
  useEffect(() => {
    if (!syncMessage) return;
    const timeout = window.setTimeout(() => setSyncMessage(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [syncMessage]);
  const title = navigation.find((item) => item.id === view)!.label;
  const match = (...values: (string | null | undefined)[]) =>
    values.join(" ").toLowerCase().includes(query.trim().toLowerCase());
  const filteredEvents = events.filter(
    (event) =>
      match(
        event.event.replaceAll("_", " "),
        eventName(event.event),
        event.action,
        event.repository_full_name,
        event.sender_login,
      ) &&
      (eventType === "all" || event.event === eventType) &&
      (repository === "all" || event.repository_full_name === repository),
  );
  const filteredRepos = repositories.filter((repo) =>
    match(repo.full_name, repo.default_branch),
  );
  const filteredIssues = issues.filter((issue) =>
    match(
      issue.title,
      String(issue.github_issue_number),
      ...issue.assignee_logins,
      ...issue.labels,
    ),
  );
  const filteredClosedIssues = closedIssues.filter((issue) =>
    match(issue.title, String(issue.github_issue_number), ...issue.assignee_logins, ...issue.labels),
  );
  const issueById = new Map([...issues, ...closedIssues].map((issue) => [String(issue.github_issue_id), issue]));
  const prById = new Map([...pullRequests, ...merged].map((pr) => [String(pr.github_pull_request_id), pr]));
  const prsByIssue = new Map<string, PullRequestRow[]>();
  const issuesByPr = new Map<string, IssueRow[]>();
  for (const link of links) {
    const issueId = String(link.github_issue_id);
    const prId = String(link.github_pull_request_id);
    const issue = issueById.get(issueId);
    const pr = prById.get(prId);
    if (issue && pr) {
      prsByIssue.set(issueId, [...(prsByIssue.get(issueId) ?? []), pr]);
      issuesByPr.set(prId, [...(issuesByPr.get(prId) ?? []), issue]);
    }
  }
  const filterPrs = (items: PullRequestRow[]) =>
    items.filter((pr) =>
      match(
        pr.title,
        String(pr.github_pull_request_number),
        pr.author_login,
        pr.head_ref,
        pr.base_ref,
      ),
    );
  const filteredPrs = filterPrs(pullRequests);
  const filteredMerged = filterPrs(merged);
  const navigate = (next: View) => {
    setView(next);
    setQuery("");
    setMenuOpen(false);
    setEventType("all");
    setRepository("all");
  };
  const refresh = async () => {
    setSyncing(true);
    setSyncFailed(false);
    setSyncMessage("");
    try {
      const response = await fetch("/api/github/sync", { method: "POST" });
      const result = (await response.json()) as { checked?: number; failed?: number; skipped?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "GitHub sync failed");
      setSyncFailed(Boolean(result.failed));
      setSyncMessage(
        result.failed
          ? `Checked ${result.checked ?? 0} records; ${result.failed} could not be checked.`
          : result.skipped
            ? `Checked ${result.checked ?? 0} records; ${result.skipped} unavailable repositories were disabled.`
          : `Checked ${result.checked ?? 0} recent issues and linked pull requests.`,
      );
      startTransition(() => router.refresh());
    } catch (error) {
      setSyncFailed(true);
      setSyncMessage(error instanceof Error ? error.message : "GitHub sync failed");
    } finally {
      setSyncing(false);
    }
  };
  const latest = events[0];
  const repoNames = [
    ...new Set(
      events
        .map((e) => e.repository_full_name)
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  return (
    <div
      className="workspace"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuTrigger.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>
      <aside
        id="workspace-navigation"
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button sidebar-close"
            aria-label="Close navigation"
            onClick={() => {
              setMenuOpen(false);
              menuTrigger.current?.focus();
            }}
          >
            <X size={19} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="workspace-avatar">
            <Github size={19} />
          </span>
          <div>
            <strong>GitHub workspace</strong>
            <span>Repository activity</span>
          </div>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "merged" && <span className="nav-merge-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="https://github.com/settings/installations"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
          >
            <Settings2 size={18} />
            <span>Manage connections</span>
            <ArrowUpRight size={14} />
          </a>
          <a
            href="https://github.com/apps/plinger"
            target="_blank"
            rel="noreferrer"
            className="nav-item"
          >
            <Github size={18} />
            <span>Plinger on GitHub</span>
            <ArrowUpRight size={14} />
          </a>
          <form action={signOut}>
            <button className="nav-item" type="submit">
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
          <div className="sidebar-status">
            <span className={`status-dot ${connected ? "" : "offline"}`} />
            <span>
              {connected
                ? "GitHub activity connected"
                : "Connection unavailable"}
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              ref={menuTrigger}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-status">
              <span className={`status-dot ${connected ? "" : "offline"}`} />
              {connected ? "Connected" : "Offline"}
            </span>
            <a
              className="icon-button"
              href="https://github.com/apps/plinger"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Plinger on GitHub"
              title="Open Plinger on GitHub"
            >
              <Github size={19} />
            </a>
          </div>
        </header>
        <main id="workspace-main" className="workspace-main">
          <div className="page-heading">
            <div>
              <p className="overline">YOUR WORKSPACE AT A GLANCE</p>
              <h1>{title}</h1>
              <p>{subtitles[view]}</p>
            </div>
            <div className="heading-actions">
              <button
                className="button button-white"
                onClick={refresh}
                disabled={pending || syncing}
              >
                <RefreshCw size={15} className={pending || syncing ? "spinning" : ""} />
                {pending || syncing ? "Syncing" : "Sync GitHub"}
              </button>
              <a
                className="button button-black"
                href="https://github.com/apps/plinger/installations/new"
                target="_blank"
                rel="noreferrer"
              >
                <Plus size={16} />
                Connect repository
              </a>
            </div>
          </div>
          {syncMessage && (
            <p className={`sync-message ${syncFailed ? "sync-error" : ""}`} role="status">
              {syncMessage}
            </p>
          )}
          {(!connected || failed) && (
            <div className="connection-notice" role="status">
              <Inbox size={19} />
              <div>
                <strong>
                  {failed
                    ? "Activity is temporarily unavailable"
                    : "Your workspace is waiting for a connection"}
                </strong>
                <p>
                  {failed
                    ? "Refresh to try loading your activity again."
                    : "Connect Plinger to GitHub to start receiving repository activity."}
                </p>
              </div>
            </div>
          )}
          {view === "overview" && (
            <section className="metrics" aria-label="Recently updated records">
              <Metric
                label="Repositories"
                value={failed ? null : repositories.length}
                icon={BookOpen}
                tone="neutral"
                onClick={() => navigate("repositories")}
              />
              <Metric
                label="Open issues"
                value={failed ? null : issues.length}
                icon={CircleDot}
                tone="green"
                onClick={() => navigate("issues")}
              />
              <Metric
                label="Linked pull requests"
                value={failed ? null : pullRequests.length}
                icon={GitPullRequest}
                tone="blue"
                onClick={() => navigate("pull-requests")}
              />
              <Metric
                label="Merged pull requests"
                value={failed ? null : merged.length}
                icon={GitMerge}
                tone="purple"
                onClick={() => navigate("merged")}
              />
            </section>
          )}
          {view !== "scouters" && <div className="workspace-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input
                type="search"
                aria-label={`Search ${view === "overview" ? "workspace" : title.toLowerCase()}`}
                placeholder={
                  view === "overview"
                    ? "Search your workspace..."
                    : `Search ${title.toLowerCase()}...`
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button
                  className="clear-search"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <X size={15} />
                </button>
              )}
            </label>
            <span className="snapshot-note">
              Recently updated records <span>·</span>
              <time dateTime={new Date(fetchedAt).toISOString()}>
                Refreshed {new Date(fetchedAt).toISOString().slice(11, 16)} UTC
              </time>
            </span>
          </div>}
          {view === "scouters" && (
            <ScoutersView scouters={scouters} total={scouterCount} unavailable={scoutersUnavailable} historyUnavailable={scouterHistoryUnavailable} refreshKey={fetchedAt} />
          )}
          {view !== "scouters" && <div
            aria-busy={pending}
            className={view === "overview" ? "overview-grid" : "single-view"}
          >
            {(view === "overview" || view === "activity") && (
              <section className="activity-section">
                <SectionHeading
                  title="Recent activity"
                  detail="The latest from your workspace"
                  action={
                    view === "overview" ? () => navigate("activity") : undefined
                  }
                />
                <div className="filter-bar">
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger aria-label="Filter event type" className="filter-select-event">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All activity</SelectItem>
                      {[...new Set(events.map((e) => e.event))].map((type) => (
                        <SelectItem key={type} value={type}>
                          {eventName(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={repository} onValueChange={setRepository}>
                    <SelectTrigger aria-label="Filter repository" className="filter-select-repository">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="select-content-repository">
                      <SelectItem value="all">All repositories</SelectItem>
                      {repoNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="result-count" aria-live="polite">
                    {view === "overview" && filteredEvents.length > 4
                      ? `4 of ${filteredEvents.length}`
                      : filteredEvents.length}{" "}
                    events
                  </span>
                </div>
                <EventList
                  events={
                    view === "overview"
                      ? filteredEvents.slice(0, 4)
                      : filteredEvents
                  }
                  now={fetchedAt}
                  filtered={Boolean(
                    query || eventType !== "all" || repository !== "all",
                  )}
                />
                <div className="section-foot">
                  <span
                    className={`status-dot ${connected ? "" : "offline"}`}
                  />
                  {latest
                    ? `Last received ${relativeTime(latest.received_at, fetchedAt)}`
                    : "No activity received yet"}
                </div>
              </section>
            )}
            {(view === "overview" || view === "repositories") && (
              <section className="repository-section">
                <SectionHeading
                  title="Repositories"
                  detail="Your connected projects"
                  action={
                    view === "overview"
                      ? () => navigate("repositories")
                      : undefined
                  }
                />
                <RepositoryList
                  repositories={filteredRepos}
                  filtered={Boolean(query)}
                />
                <a
                  href="https://github.com/apps/plinger/installations/new"
                  className="add-repository"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Plus size={16} />
                  Connect a repository
                  <ArrowUpRight size={15} />
                </a>
              </section>
            )}
            {(view === "overview" ||
              view === "issues" ||
              view === "closed-issues" ||
              view === "pull-requests" ||
              view === "merged") && (
              <section className="queue-section">
                <SectionHeading
                  title={view === "overview" ? "Your work queue" : title}
                  detail={
                    view === "merged"
                      ? "Recently completed work"
                      : "Recently updated issues and pull requests"
                  }
                />
                {view === "overview" && (
                  <div className="queue-tabs" aria-label="Work queue view">
                    {(
                      [
                        {
                          id: "issues",
                          label: "Open issues",
                          count: issues.length,
                          icon: CircleDot,
                        },
                        {
                          id: "pull-requests",
                          label: "Pull requests",
                          count: pullRequests.length,
                          icon: GitPullRequest,
                        },
                        {
                          id: "merged",
                          label: "Merged",
                          count: merged.length,
                          icon: GitMerge,
                        },
                      ] as const
                    ).map(({ id, label, count, icon: Icon }) => (
                      <button
                        key={id}
                        aria-pressed={queue === id}
                        className={queue === id ? "selected" : ""}
                        onClick={() => setQueue(id)}
                      >
                        <Icon size={15} />
                        {label}
                        <span>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {(view === "overview" ? queue : view) === "issues" || view === "closed-issues" ? (
                  <IssueList
                    issues={view === "closed-issues" ? filteredClosedIssues : filteredIssues}
                    linkedPrs={prsByIssue}
                    now={fetchedAt}
                    filtered={Boolean(query)}
                  />
                ) : (
                  <PullRequestList
                    items={
                      (view === "overview" ? queue : view) === "merged"
                        ? filteredMerged
                        : filteredPrs
                    }
                    now={fetchedAt}
                    merged={(view === "overview" ? queue : view) === "merged"}
                    linkedIssues={issuesByPr}
                    filtered={Boolean(query)}
                  />
                )}
              </section>
            )}
          </div>}
          <footer className="workspace-footer">
            <span>
              Plinger <span className="footer-dot">/</span> A clearer view of
              your work.
            </span>
            <a
              href="https://github.com/apps/plinger"
              target="_blank"
              rel="noreferrer"
            >
              Connected through GitHub <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | null;
  icon: LucideIcon;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className="metric" onClick={onClick}>
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={18} className={`${tone}-text`} />
      </div>
      <div className="metric-value">
        <strong>{value ?? "--"}</strong>
        <ArrowUpRight size={19} />
      </div>
      <span className="metric-caption">
        {value === null ? "Temporarily unavailable" : "Recently updated"}
      </span>
    </button>
  );
}
function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && (
        <button
          className="text-button"
          onClick={action}
          aria-label={`Explore ${title.toLowerCase()}`}
        >
          Explore <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
function EmptyState({
  title,
  filtered,
  detail,
}: {
  title: string;
  filtered: boolean;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={23} />
      </span>
      <h3>{filtered ? "No matches found" : title}</h3>
      <p>{filtered ? "Try another search or adjust your filters." : detail}</p>
    </div>
  );
}
function EventList({
  events,
  now,
  filtered,
}: {
  events: WebhookEventRow[];
  now: number;
  filtered: boolean;
}) {
  if (!events.length)
    return (
      <EmptyState
        title="A quiet moment"
        detail="New repository activity will appear here when it arrives."
        filtered={filtered}
      />
    );
  return (
    <ul className="event-feed">
      {events.map((event) => {
        const Icon =
          event.event === "push"
            ? GitCommitHorizontal
            : event.event === "pull_request"
              ? GitPullRequest
              : event.event === "issues"
                ? CircleDot
                : BookOpen;
        const tone =
          event.event === "push"
            ? "blue"
            : event.event === "issues"
              ? "green"
              : "neutral";
        return (
          <li key={event.id}>
            <span className={`event-icon ${tone}`}>
              <Icon size={17} />
            </span>
            <div className="event-content">
              <div>
                <strong>{eventName(event.event)}</strong>
                <span className="event-action">
                  {event.action?.replaceAll("_", " ") ??
                    (event.event === "push" ? "pushed" : "updated")}
                </span>
              </div>
              <p>
                {event.repository_full_name ? (
                  <a
                    href={`https://github.com/${event.repository_full_name}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {event.repository_full_name}
                  </a>
                ) : (
                  "Account activity"
                )}
                <span className="event-sender">
                  {event.sender_login && (
                    <>
                      by{" "}
                      <a
                        href={`https://github.com/${event.sender_login}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {event.sender_login}
                      </a>
                    </>
                  )}
                </span>
              </p>
            </div>
            <time
              dateTime={event.received_at}
              title={new Date(event.received_at).toUTCString()}
            >
              {relativeTime(event.received_at, now)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
function RepositoryList({
  repositories,
  filtered,
}: {
  repositories: RepositoryRow[];
  filtered: boolean;
}) {
  if (!repositories.length)
    return (
      <EmptyState
        title="Your projects belong here"
        detail="Connect a repository to start following its activity."
        filtered={filtered}
      />
    );
  return (
    <ul className="repository-list">
      {repositories.map((repo) => (
        <li key={repo.id}>
          <a
            href={`https://github.com/${repo.full_name}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="repo-icon">
              <BookOpen size={19} />
            </span>
            <div className="repository-info">
              <h3>
                {repo.name}{" "}
                {repo.private && (
                  <LockKeyhole size={12} aria-label="Private repository" />
                )}
              </h3>
              <p>
                {repo.owner_login}
                <span> / </span>
                <GitBranch size={12} />{" "}
                {repo.default_branch ?? "Default branch"}
              </p>
            </div>
            <span
              className={`repo-state ${repo.disabled || repo.archived ? "muted" : ""}`}
            >
              {repo.disabled ? (
                "Disabled"
              ) : repo.archived ? (
                "Archived"
              ) : (
                <Check size={14} aria-label="Active" />
              )}
            </span>
            <ArrowUpRight size={14} className="repo-link-icon" />
          </a>
        </li>
      ))}
    </ul>
  );
}
function WorkTitle({ url, title }: { url: string | null; title: string }) {
  return url && /^https:\/\/github\.com\//.test(url) ? (
    <a className="work-link" href={url} target="_blank" rel="noreferrer">
      {title}
      <ExternalLink size={13} />
    </a>
  ) : (
    <strong className="work-link">{title}</strong>
  );
}
function IssueList({
  issues,
  linkedPrs,
  now,
  filtered,
}: {
  issues: IssueRow[];
  linkedPrs: Map<string, PullRequestRow[]>;
  now: number;
  filtered: boolean;
}) {
  if (!issues.length)
    return (
      <EmptyState
        title="No issues here yet"
        detail="Issues will appear here as GitHub sends updates."
        filtered={filtered}
      />
    );
  return (
    <div className="work-table-wrap">
      <table className="work-table">
        <thead>
          <tr>
            <th scope="col">Issue</th>
            <th scope="col">Assignee</th>
            <th scope="col">Status</th>
            <th scope="col">Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <div className="work-name">
                  <CircleDot size={18} className="green-text" />
                  <div>
                    <WorkTitle url={issue.url} title={issue.title} />
                    <p className="work-meta">
                      <span>#{issue.github_issue_number}</span>
                      {(linkedPrs.get(String(issue.github_issue_id)) ?? []).map((pr) => (
                        <a key={pr.id} href={pr.url ?? "#"} target="_blank" rel="noreferrer">
                          PR #{pr.github_pull_request_number} · {prStatus(pr).label}
                        </a>
                      ))}
                      {issue.labels.slice(0, 2).map((label) => (
                        <span className="label-tag" key={label}>
                          {label}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              </td>
              <td>
                {issue.assignee_logins.length ? (
                  <div className="assignees">
                    {issue.assignee_logins.map((name) => (
                      <a
                        href={`https://github.com/${name}`}
                        key={name}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="avatar-initial">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        {name}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </td>
              <td>
                <span className={`badge ${issue.state === "closed" ? "purple" : "green"}`}>
                  {issue.state === "closed" ? <Check size={12} /> : <CircleDot size={12} />}
                  {issue.state === "closed" ? "Closed" : "Open"}
                </span>
              </td>
              <td>
                <time dateTime={issue.updated_at}>
                  {relativeTime(issue.updated_at, now)}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PullRequestList({
  items,
  linkedIssues,
  now,
  merged,
  filtered,
}: {
  items: PullRequestRow[];
  linkedIssues: Map<string, IssueRow[]>;
  now: number;
  merged: boolean;
  filtered: boolean;
}) {
  if (!items.length)
    return (
      <EmptyState
        title={
          merged ? "The next merge starts here" : "No pull requests waiting"
        }
        detail={
          merged
            ? "Completed merges will appear as your team ships work."
            : "Linked pull requests will appear here."
        }
        filtered={filtered}
      />
    );
  return (
    <div className="work-table-wrap">
      <table className="work-table">
        <thead>
          <tr>
            <th scope="col">Pull request</th>
            <th scope="col">Author</th>
            <th scope="col">Status</th>
            <th scope="col">{merged ? "Merged" : "Updated"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((pr) => (
            <tr key={pr.id}>
              <td>
                <div className="work-name">
                  {merged ? (
                    <GitMerge size={18} className="purple-text" />
                  ) : (
                    <GitPullRequest size={18} className="green-text" />
                  )}
                  <div>
                    <WorkTitle url={pr.url} title={pr.title} />
                    <p className="work-meta">
                      <span>#{pr.github_pull_request_number}</span>
                      {(linkedIssues.get(String(pr.github_pull_request_id)) ?? []).map((issue) => (
                        <a key={issue.id} href={issue.url ?? "#"} target="_blank" rel="noreferrer">
                          Issue #{issue.github_issue_number}
                        </a>
                      ))}
                      <span className="branch-name">
                        {pr.head_ref ?? "head"} <ArrowRight size={11} />{" "}
                        {pr.base_ref ?? "base"}
                      </span>
                    </p>
                  </div>
                </div>
              </td>
              <td>{pr.author_login ?? "Unknown"}</td>
              <td>
                <span
                  className={`badge ${merged ? "purple" : prStatus(pr).tone}`}
                >
                  {merged ? "Merged" : prStatus(pr).label}
                </span>
              </td>
              <td>
                <time dateTime={pr.merged_at ?? pr.updated_at}>
                  {relativeTime(
                    merged ? (pr.merged_at ?? pr.updated_at) : pr.updated_at,
                    now,
                  )}
                </time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function eventName(event: string) {
  return (
    (
      {
        push: "Commits",
        issues: "Issue",
        pull_request: "Pull request",
        installation: "Connection",
        installation_repositories: "Repository access",
      } as Record<string, string>
    )[event] ?? event.replaceAll("_", " ")
  );
}
function relativeTime(value: string, now: number) {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 1000),
  );
  if (!Number.isFinite(seconds)) return "Unknown";
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
