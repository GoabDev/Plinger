"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CircleDot,
  GitMerge,
  GitPullRequest,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import type { IssueRow, PullRequestRow, WebhookEventRow } from "../../lib/dashboard/data";
import type { ScouterProfile, ScouterRow } from "../../lib/dashboard/scouters";
import { prStatus } from "../../lib/dashboard/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import ScouterAdminDetails, { type AdminProfile } from "./scouter-admin-details";

type ProfileTab = "issues" | "pull-requests" | "activity" | "repositories";
type IssueFilter = "all" | "open" | "closed";
type PullRequestFilter = "all" | "open" | "merged" | "closed";

export default function ScoutersView({
  scouters,
  total,
  unavailable,
  historyUnavailable,
  refreshKey,
}: {
  scouters: ScouterRow[];
  total: number;
  unavailable: boolean;
  historyUnavailable: boolean;
  refreshKey: number;
}) {
  const ordered = useMemo(
    () => [...scouters].sort((a, b) => Number(Boolean(a.uninstalled_at || a.suspended_at)) - Number(Boolean(b.uninstalled_at || b.suspended_at)) || a.account_login.localeCompare(b.account_login)),
    [scouters],
  );
  const [selectedLogin, setSelectedLogin] = useState<string | null>(ordered[0]?.account_login ?? null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tab, setTab] = useState<ProfileTab>("issues");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [prFilter, setPrFilter] = useState<PullRequestFilter>("all");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (mobileProfileOpen && backButtonRef.current?.getClientRects().length) {
      backButtonRef.current.focus();
    } else if (!mobileProfileOpen) {
      selectedRowRef.current?.focus({ preventScroll: true });
    }
  }, [mobileProfileOpen]);

  useEffect(() => {
    if (selectedLogin && !ordered.some((scouter) => scouter.account_login === selectedLogin)) {
      setSelectedLogin(ordered[0]?.account_login ?? null);
    }
  }, [ordered, selectedLogin]);

  useEffect(() => {
    if (!selectedLogin || unavailable) return;
    const controller = new AbortController();
    setLoading(true);
    setProfile(null);
    setError("");
    fetch(`/api/scouters/${encodeURIComponent(selectedLogin)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Scouter activity is unavailable");
        return body as AdminProfile;
      })
      .then((data) => setProfile(data))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Scouter activity is unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedLogin, unavailable, retry, refreshKey]);

  const filtered = ordered.filter((scouter) => {
    const disconnected = Boolean(scouter.uninstalled_at || scouter.suspended_at);
    return scouter.account_login.toLowerCase().includes(query.trim().toLowerCase()) &&
      (statusFilter === "all" || (statusFilter === "connected" && !disconnected) || (statusFilter === "disconnected" && disconnected));
  });

  const issueRows = profile
    ? [...profile.openIssues.data, ...profile.closedIssues.data]
        .filter((issue) => issueFilter === "all" || issue.state === issueFilter)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : [];
  const prRows = profile
    ? [...profile.openPullRequests.data, ...profile.mergedPullRequests.data, ...profile.closedPullRequests.data]
        .filter((pr) => prFilter === "all" || (prFilter === "merged" ? pr.merged : prFilter === "closed" ? pr.state === "closed" && !pr.merged : pr.state === "open"))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    : [];

  return (
    <section className={`scouters-layout ${mobileProfileOpen ? "is-profile-open" : ""}`} aria-label="Scouters">
      <div className="scouters-directory">
        <div className="scouters-directory-heading">
          <div>
            <h2>Scouters</h2>
            <span>{total} personal installation{total === 1 ? "" : "s"}</span>
          </div>
          <Users size={18} aria-hidden="true" />
        </div>
        {historyUnavailable && <p className="scouters-history-warning" role="status">Removed-installation history is unavailable.</p>}
        {scouters.some((scouter) => scouter.has_authenticated === null) && <p className="scouters-history-warning" role="status">Plinger sign-in status is unavailable.</p>}
        <label className="scouters-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search scouters"
            placeholder="Search scouters"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && <button type="button" aria-label="Clear scouter search" onClick={() => setQuery("")}><X size={15} /></button>}
        </label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter scouter connection status" className="scouters-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="disconnected">Suspended or removed</SelectItem>
          </SelectContent>
        </Select>
        <div className="scouters-directory-list" aria-label="Personal installations">
          {unavailable ? (
            <p className="scouters-directory-empty">Scouters are temporarily unavailable.</p>
          ) : !ordered.length ? (
            <p className="scouters-directory-empty">No personal accounts have installed Plinger yet.</p>
          ) : !filtered.length ? (
            <p className="scouters-directory-empty">No scouters match this search.</p>
          ) : (
            filtered.map((scouter) => (
              <button
                type="button"
                key={scouter.installation_id}
                className={`scouter-directory-row ${selectedLogin === scouter.account_login ? "selected" : ""}`}
                aria-current={selectedLogin === scouter.account_login ? "true" : undefined}
                onClick={(event) => {
                  selectedRowRef.current = event.currentTarget;
                  setMobileProfileOpen(true);
                  setSelectedLogin(scouter.account_login);
                  setTab("issues");
                  setIssueFilter("all");
                  setPrFilter("all");
                }}
              >
                <ScouterAvatar scouter={scouter} />
                <span className="scouter-directory-name">
                  <strong>{scouter.account_login}</strong>
                  <small>{connectionLabel(scouter)}</small>
                </span>
                <span className="scouter-account-indicators">
                  <span className={`scouter-connection-dot ${scouter.uninstalled_at || scouter.suspended_at ? "inactive" : ""}`} aria-hidden="true" />
                  {scouter.has_authenticated && <span className="scouter-authenticated-dot" role="img" aria-label="Has signed into Plinger" title="Has signed into Plinger" />}
                </span>
              </button>
            ))
          )}
        </div>
        {total > scouters.length && <p className="scouters-directory-count">Showing {scouters.length} of {total}</p>}
      </div>

      <div className="scouters-profile" aria-live="polite">
        <button ref={backButtonRef} type="button" className="scouters-back button button-white" onClick={() => setMobileProfileOpen(false)}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to scouters
        </button>
        {!selectedLogin || unavailable ? (
          <ScouterEmpty title={unavailable ? "Scouters are unavailable" : "No scouter selected"} detail={unavailable ? "Refresh the workspace to try again." : "Install Plinger on a personal GitHub account to see it here."} />
        ) : loading ? (
          <div className="scouters-loading" role="status"><RefreshCw size={18} className="spinning" /> Loading {selectedLogin}</div>
        ) : error ? (
          <ScouterEmpty title="Could not load this scouter" detail={error} action={<button type="button" className="button button-white" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={15} /> Retry</button>} />
        ) : profile ? (
          <>
            <div className="scouter-profile-heading">
              <ScouterAvatar scouter={profile.scouter} large />
              <div className="scouter-profile-identity">
                <p className="overline">PERSONAL INSTALLATION</p>
                <h2>{profile.scouter.account_login}</h2>
                <div className="scouter-profile-meta">
                  <span className={`scouter-state ${profile.scouter.uninstalled_at || profile.scouter.suspended_at ? "inactive" : ""}`}>{connectionLabel(profile.scouter)}</span>
                  <span>GitHub ID {profile.scouter.account_id ?? "Unavailable"}</span>
                  <span>Recorded {formatDate(profile.scouter.created_at)}</span>
                </div>
              </div>
              <a className="button button-white scouter-github-link" href={`https://github.com/${profile.scouter.account_login}`} target="_blank" rel="noreferrer">
                GitHub profile <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>

            <ScouterAdminDetails profile={profile} onRefresh={() => setRetry((value) => value + 1)} />
            <div className="scouter-metrics" aria-label="Scouter work totals">
              <Metric label="Open issues" value={profile.openIssues.count} icon={CircleDot} onClick={() => { setTab("issues"); setIssueFilter("open"); }} />
              <Metric label="Closed issues" value={profile.closedIssues.count} icon={CircleDot} onClick={() => { setTab("issues"); setIssueFilter("closed"); }} />
              <Metric label="Open PRs" value={profile.openPullRequests.count} icon={GitPullRequest} onClick={() => { setTab("pull-requests"); setPrFilter("open"); }} />
              <Metric label="Merged PRs" value={profile.mergedPullRequests.count} icon={GitMerge} onClick={() => { setTab("pull-requests"); setPrFilter("merged"); }} />
              <Metric label="Closed unmerged" value={profile.closedPullRequests.count} icon={GitPullRequest} onClick={() => { setTab("pull-requests"); setPrFilter("closed"); }} />
            </div>

            <div className="scouter-tabs" role="tablist" aria-label="Scouter details">
              {([
                ["issues", "Issues", profile.openIssues.count + profile.closedIssues.count],
                ["pull-requests", "Pull requests", profile.openPullRequests.count + profile.mergedPullRequests.count + profile.closedPullRequests.count],
                ["activity", "Activity", profile.activity.count],
                ["repositories", "Repositories", profile.repositories.count],
              ] as const).map(([id, label, count]) => (
                <button key={id} id={`scouter-tab-${id}`} type="button" role="tab" aria-controls="scouter-tab-panel" aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className={tab === id ? "active" : ""} onClick={() => setTab(id)} onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const tabs = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
                  const next = (tabs.indexOf(event.currentTarget) + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                  tabs[next]?.focus();
                  if (tabs[next]?.id) setTab(tabs[next].id.replace("scouter-tab-", "") as ProfileTab);
                }}>
                  {label}<span>{count}</span>
                </button>
              ))}
            </div>

            <div key={`${selectedLogin}-${tab}`} id="scouter-tab-panel" className="scouter-tab-panel" role="tabpanel" tabIndex={0} aria-labelledby={`scouter-tab-${tab}`}>
              {tab === "issues" && <>
                <div className="scouter-content-heading"><h3>Currently assigned issues</h3><FilterGroup label="Issue status" values={[["all", "All"], ["open", "Open"], ["closed", "Closed"]]} value={issueFilter} onChange={(value) => setIssueFilter(value as IssueFilter)} /></div>
                <IssueTable rows={issueRows} linkedPullRequests={profile.linkedPullRequests} />
                <ResultLimit shown={issueRows.length} total={issueFilter === "all" ? profile.openIssues.count + profile.closedIssues.count : issueFilter === "open" ? profile.openIssues.count : profile.closedIssues.count} />
              </>}
              {tab === "pull-requests" && <>
                <div className="scouter-content-heading"><h3>Authored pull requests</h3><FilterGroup label="Pull request status" values={[["all", "All"], ["open", "Open"], ["merged", "Merged"], ["closed", "Closed"]]} value={prFilter} onChange={(value) => setPrFilter(value as PullRequestFilter)} /></div>
                <PullRequestTable rows={prRows} />
                <ResultLimit shown={prRows.length} total={prFilter === "all" ? profile.openPullRequests.count + profile.mergedPullRequests.count + profile.closedPullRequests.count : prFilter === "open" ? profile.openPullRequests.count : prFilter === "merged" ? profile.mergedPullRequests.count : profile.closedPullRequests.count} />
              </>}
              {tab === "activity" && <>
                <div className="scouter-content-heading"><h3>Recent activity</h3></div>
                <ActivityList rows={profile.activity.data} />
                <ResultLimit shown={profile.activity.data.length} total={profile.activity.count} />
              </>}
              {tab === "repositories" && <>
                <div className="scouter-content-heading"><h3>Connected repositories</h3></div>
                <RepositoryList rows={profile.repositories.data} />
                <ResultLimit shown={profile.repositories.data.length} total={profile.repositories.count} />
              </>}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ScouterAvatar({ scouter, large = false }: { scouter: ScouterRow; large?: boolean }) {
  return <span className={`scouter-avatar ${large ? "large" : ""}`}>
    <span>{scouter.account_login.slice(0, 1).toUpperCase()}</span>
    {scouter.account_id && <img src={`https://avatars.githubusercontent.com/u/${scouter.account_id}?s=128&v=4`} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
  </span>;
}

function connectionLabel(scouter: ScouterRow) {
  if (scouter.uninstalled_at) return "Removed";
  if (scouter.suspended_at) return "Suspended";
  return "Connected";
}

function Metric({ label, value, icon: Icon, onClick }: { label: string; value: number; icon: typeof CircleDot; onClick: () => void }) {
  return <button type="button" className="scouter-metric" onClick={onClick}>
    <span><span>{label}</span><Icon size={17} aria-hidden="true" /></span>
    <strong>{value}</strong>
  </button>;
}

function FilterGroup({ label, values, value, onChange }: { label: string; values: readonly (readonly [string, string])[]; value: string; onChange: (value: string) => void }) {
  return <div className="scouter-filter-group" aria-label={label}>
    {values.map(([id, text]) => <button key={id} type="button" aria-pressed={value === id} className={value === id ? "active" : ""} onClick={() => onChange(id)}>{text}</button>)}
  </div>;
}

function IssueTable({ rows, linkedPullRequests }: { rows: IssueRow[]; linkedPullRequests: ScouterProfile["linkedPullRequests"] }) {
  if (!rows.length) return <ScouterEmpty title="No assigned issues" detail="Issues currently assigned to this scouter will appear here." />;
  return <div className="scouter-table-wrap"><table className="scouter-table">
    <thead><tr><th scope="col">Issue</th><th scope="col">Repository</th><th scope="col">Issue status</th><th scope="col">Linked PRs</th><th scope="col">Updated</th></tr></thead>
    <tbody>{rows.map((issue) => <tr key={issue.id}>
      <td><WorkLink url={issue.url} title={issue.title} /><span className="scouter-row-number">#{issue.github_issue_number}</span></td>
      <td>{repositoryName(issue.url)}</td>
      <td><span className={`badge ${issue.state === "closed" ? "purple" : "green"}`}>{issue.state === "closed" ? "Closed" : "Open"}</span></td>
      <td><div className="scouter-linked-prs">{linkedPullRequests.filter((link) => link.github_issue_id === issue.github_issue_id).map(({ pull_request: pr }) => {
        const status = prStatus(pr);
        return <span key={pr.id}><WorkLink url={pr.url} title={`#${pr.github_pull_request_number}`} /><span className={`badge ${status.tone}`}>{status.label}</span></span>;
      })}{!linkedPullRequests.some((link) => link.github_issue_id === issue.github_issue_id) && <span className="muted">None recorded</span>}</div></td>
      <td><time dateTime={issue.updated_at}>{formatDate(issue.updated_at)}</time></td>
    </tr>)}</tbody>
  </table></div>;
}

function PullRequestTable({ rows }: { rows: PullRequestRow[] }) {
  if (!rows.length) return <ScouterEmpty title="No pull requests" detail="Pull requests authored by this scouter will appear here." />;
  return <div className="scouter-table-wrap"><table className="scouter-table">
    <thead><tr><th scope="col">Pull request</th><th scope="col">Repository</th><th scope="col">Status</th><th scope="col">Updated</th></tr></thead>
    <tbody>{rows.map((pr) => { const status = prStatus(pr); return <tr key={pr.id}>
      <td><WorkLink url={pr.url} title={pr.title} /><span className="scouter-row-number">#{pr.github_pull_request_number}</span></td>
      <td>{repositoryName(pr.url)}</td>
      <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
      <td><time dateTime={pr.updated_at}>{formatDate(pr.updated_at)}</time></td>
    </tr>; })}</tbody>
  </table></div>;
}

function ActivityList({ rows }: { rows: WebhookEventRow[] }) {
  if (!rows.length) return <ScouterEmpty title="No activity yet" detail="GitHub webhook activity associated with this account will appear here." />;
  return <ul className="scouter-activity-list">{rows.map((event) => <li key={event.id}>
    <span className="scouter-activity-icon"><Activity size={17} aria-hidden="true" /></span>
    <span><strong>{event.event.replaceAll("_", " ")}{event.action ? ` · ${event.action}` : ""}</strong><small>{event.repository_full_name ?? "GitHub"}</small></span>
    <time dateTime={event.received_at}>{formatDate(event.received_at)}</time>
  </li>)}</ul>;
}

function RepositoryList({ rows }: { rows: ScouterProfile["repositories"]["data"] }) {
  if (!rows.length) return <ScouterEmpty title="No repositories recorded" detail="Repositories owned by this account will appear here when Plinger receives them." />;
  return <ul className="scouter-repo-list">{rows.map((repo) => <li key={repo.id}>
    <BookOpen size={17} aria-hidden="true" />
    <a href={`https://github.com/${repo.full_name}`} target="_blank" rel="noreferrer">{repo.full_name}<ArrowUpRight size={14} aria-hidden="true" /></a>
    <span>{repo.private ? "Private" : "Public"}</span>
  </li>)}</ul>;
}

function WorkLink({ url, title }: { url: string | null; title: string }) {
  const safe = url?.startsWith("https://github.com/") ? url : null;
  return safe ? <a className="scouter-work-link" href={safe} target="_blank" rel="noreferrer">{title}<ArrowUpRight size={14} aria-hidden="true" /></a> : <strong className="scouter-work-link">{title}</strong>;
}

function ScouterEmpty({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <div className="scouter-empty"><Users size={22} aria-hidden="true" /><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function ResultLimit({ shown, total }: { shown: number; total: number }) {
  return total > shown ? <p className="scouter-result-limit">Showing {shown} of {total} records</p> : null;
}

function repositoryName(url: string | null) {
  if (!url) return "Unknown";
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return "Unknown";
    return parsed.pathname.split("/").slice(1, 3).join("/") || "Unknown";
  } catch { return "Unknown"; }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
