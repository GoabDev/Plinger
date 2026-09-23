import "server-only";
import { selectSupabaseRows } from "../supabase/server";
import { listGitHubAppInstallations } from "../github/api";
import type { IssueRow, PullRequestRow, RepositoryRow, WebhookEventRow } from "./data";
import { createClient } from "@supabase/supabase-js";

export type ScouterRow = {
  id: string;
  installation_id: number;
  account_id: number | null;
  account_login: string;
  suspended_at: string | null;
  uninstalled_at: string | null;
  created_at: string;
  has_authenticated?: boolean | null;
};

export type ScouterList<T> = { data: T[]; count: number };

export type ScouterIssueSyncState = {
  status: "pending" | "syncing" | "complete" | "stale" | "token_required" | "failed";
  coverage: "app_repositories_only" | "all_visible_repositories";
  phase: "issues" | "pull_requests";
  issue_status: "pending" | "syncing" | "complete" | "failed";
  pull_request_status: "pending" | "syncing" | "complete" | "failed";
  pages_checked: number;
  issues_seen: number;
  pull_request_pages_checked: number;
  pull_requests_seen: number;
  links_seen: number;
  last_completed_at: string | null;
  last_error: string | null;
  issue_last_error: string | null;
  pull_request_last_error: string | null;
};

export type ScouterProfile = {
  scouter: ScouterRow;
  repositories: ScouterList<RepositoryRow>;
  openIssues: ScouterList<IssueRow>;
  closedIssues: ScouterList<IssueRow>;
  openPullRequests: ScouterList<PullRequestRow>;
  mergedPullRequests: ScouterList<PullRequestRow>;
  closedPullRequests: ScouterList<PullRequestRow>;
  activity: ScouterList<WebhookEventRow>;
  linkedPullRequests: Array<{ github_issue_id: number; pull_request: PullRequestRow }>;
  assignmentSync: ScouterIssueSyncState;
};

const scouterSelect = "id,installation_id,account_id,account_login,suspended_at,uninstalled_at,created_at";
const issueSelect = "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at";
const pullRequestSelect = "id,github_pull_request_id,github_pull_request_number,title,state,url,author_login,head_ref,base_ref,merged,merged_at,mergeable,mergeable_state,updated_at";
const repositorySelect = "id,github_repository_id,owner_login,name,full_name,private,default_branch,archived,disabled,updated_at";
const eventSelect = "id,delivery_id,event,action,repository_full_name,sender_login,received_at";
const syncStateSelect = "status,coverage,phase,issue_status,pull_request_status,pages_checked,issues_seen,pull_request_pages_checked,pull_requests_seen,links_seen,last_completed_at,last_error,issue_last_error,pull_request_last_error";

function effectiveSyncState(state: ScouterIssueSyncState) {
  if (state.status !== "complete" || !state.last_completed_at) return state;
  const age = Date.now() - Date.parse(state.last_completed_at);
  return Number.isFinite(age) && age > 36 * 60 * 60 * 1000 ? { ...state, status: "stale" as const } : state;
}

async function getScouterIssues(scouter: ScouterRow, state: "open" | "closed") {
  if (scouter.account_id) {
    const normalized = await selectSupabaseRows<IssueRow>({
      table: "scouter_current_issues",
      query: {
        select: issueSelect,
        assignee_account_id: `eq.${scouter.account_id}`,
        state: `eq.${state}`,
        order: state === "open" ? "updated_at.desc" : "closed_at.desc.nullslast",
        limit: "1000",
      },
      count: "exact",
    });
    if (!normalized.error && !normalized.skipped && Number.isFinite(normalized.count)) return normalized;
  }

  return selectSupabaseRows<IssueRow>({
    table: "issues",
    query: {
      select: issueSelect,
      assignee_logins: `cs.{${scouter.account_login}}`,
      state: `eq.${state}`,
      order: state === "open" ? "updated_at.desc" : "closed_at.desc.nullslast",
      limit: "1000",
    },
    count: "exact",
  });
}

async function getAuthenticatedGitHubAccounts() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Authentication directory unavailable");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const accounts = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Authentication directory unavailable");
    for (const user of data.users) {
      if (!user.last_sign_in_at) continue;
      for (const identity of user.identities ?? []) {
        if (identity.provider !== "github") continue;
        const id = String(identity.identity_data?.sub ?? identity.id);
        if (/^\d+$/.test(id)) accounts.add(id);
      }
    }
    if (data.users.length < 1000) return accounts;
  }
}

export async function getScouterDirectory(includeAuthentication = false) {
  try {
    const [current, historical, authenticated] = await Promise.all([
      listGitHubAppInstallations(),
      selectSupabaseRows<ScouterRow>({
        table: "github_installations",
        query: {
          select: scouterSelect,
          account_type: "eq.User",
          account_login: "not.is.null",
          uninstalled_at: "not.is.null",
          order: "account_login.asc",
          limit: "1000",
        },
        count: "exact",
      }).catch(() => ({
        data: [] as ScouterRow[],
        error: "Scouter history unavailable",
        skipped: false,
        count: undefined,
      })),
      includeAuthentication ? getAuthenticatedGitHubAccounts().catch(() => null) : null,
    ]);
    const historyUnavailable = Boolean(historical.error || historical.skipped || historical.count === undefined);
    const byInstallation = new Map<number, ScouterRow>(
      (historyUnavailable ? [] : historical.data).map((row) => [row.installation_id, row]),
    );
    for (const installation of current) {
      if (installation.account?.type !== "User" || !installation.account.login) continue;
      byInstallation.set(installation.id, {
        id: String(installation.id),
        installation_id: installation.id,
        account_id: installation.account.id,
        account_login: installation.account.login,
        suspended_at: installation.suspended_at,
        uninstalled_at: null,
        created_at: installation.created_at,
      });
    }
    const data = [...byInstallation.values()].map((row) => includeAuthentication
      ? { ...row, has_authenticated: authenticated ? authenticated.has(String(row.account_id)) : null }
      : row);
    return { data, count: byInstallation.size, historyUnavailable };
  } catch (error) {
    console.error("[scouters:directory:failed]", error);
    return { data: [] as ScouterRow[], error: "Scouter directory unavailable" };
  }
}

export async function getScouterProfile(login: string): Promise<ScouterProfile | null> {
  const directory = await getScouterDirectory();
  if (directory.error) throw new Error("Scouter lookup unavailable");
  const scouter = directory.data.find((row) => row.account_login.toLowerCase() === login.toLowerCase());
  if (!scouter) return null;

  const [repositories, openIssues, closedIssues, openPullRequests, mergedPullRequests, closedPullRequests, activity, syncState] = await Promise.all([
    selectSupabaseRows<RepositoryRow>({
      table: "repositories",
      query: { select: repositorySelect, owner_login: `eq.${scouter.account_login}`, disabled: "eq.false", order: "updated_at.desc", limit: "20" },
      count: "exact",
    }),
    getScouterIssues(scouter, "open"),
    getScouterIssues(scouter, "closed"),
    selectSupabaseRows<PullRequestRow>({
      table: "pull_requests",
      query: { select: pullRequestSelect, author_login: `eq.${scouter.account_login}`, state: "eq.open", order: "updated_at.desc", limit: "20" },
      count: "exact",
    }),
    selectSupabaseRows<PullRequestRow>({
      table: "pull_requests",
      query: { select: pullRequestSelect, author_login: `eq.${scouter.account_login}`, merged: "eq.true", order: "merged_at.desc.nullslast", limit: "20" },
      count: "exact",
    }),
    selectSupabaseRows<PullRequestRow>({
      table: "pull_requests",
      query: { select: pullRequestSelect, author_login: `eq.${scouter.account_login}`, state: "eq.closed", merged: "eq.false", order: "closed_at.desc.nullslast", limit: "20" },
      count: "exact",
    }),
    selectSupabaseRows<WebhookEventRow>({
      table: "webhook_events",
      query: { select: eventSelect, sender_login: `eq.${scouter.account_login}`, order: "received_at.desc", limit: "30" },
      count: "exact",
    }),
    scouter.account_id ? selectSupabaseRows<ScouterIssueSyncState>({
      table: "scouter_issue_sync_state",
      query: { select: syncStateSelect, account_id: `eq.${scouter.account_id}`, limit: "1" },
    }) : Promise.resolve({ data: [] as ScouterIssueSyncState[], error: undefined, skipped: false }),
  ]);
  const results = { repositories, openIssues, closedIssues, openPullRequests, mergedPullRequests, closedPullRequests, activity };
  for (const result of Object.values(results)) {
    if (result.error || result.skipped || !Number.isFinite(result.count)) {
      throw new Error("Scouter activity unavailable");
    }
  }

  const issueIds = [...openIssues.data, ...closedIssues.data].map((issue) => issue.github_issue_id);
  const links = issueIds.length ? await selectSupabaseRows<{ github_issue_id: number; github_pull_request_id: number }>({
    table: "issue_pull_requests",
    query: {
      select: "github_issue_id,github_pull_request_id",
      github_issue_id: `in.(${issueIds.join(",")})`,
      limit: "1000",
    },
    count: "exact",
  }) : { data: [], count: 0 };
  if (links.error || links.skipped || links.count === undefined || links.count > links.data.length) {
    throw new Error("Scouter issue links unavailable");
  }
  const linkedIds = [...new Set(links.data.map((link) => link.github_pull_request_id))];
  const linkedRows = linkedIds.length ? await selectSupabaseRows<PullRequestRow>({
    table: "pull_requests",
    query: {
      select: pullRequestSelect,
      github_pull_request_id: `in.(${linkedIds.join(",")})`,
      limit: "1000",
    },
  }) : { data: [] as PullRequestRow[] };
  if (linkedRows.error || linkedRows.skipped) throw new Error("Scouter linked pull requests unavailable");
  const linkedById = new Map(linkedRows.data.map((pr) => [pr.github_pull_request_id, pr]));

  return {
    scouter,
    repositories: { data: repositories.data, count: repositories.count! },
    openIssues: { data: openIssues.data, count: openIssues.count! },
    closedIssues: { data: closedIssues.data, count: closedIssues.count! },
    openPullRequests: { data: openPullRequests.data, count: openPullRequests.count! },
    mergedPullRequests: { data: mergedPullRequests.data, count: mergedPullRequests.count! },
    closedPullRequests: { data: closedPullRequests.data, count: closedPullRequests.count! },
    activity: { data: activity.data, count: activity.count! },
    linkedPullRequests: links.data.flatMap((link) => {
      const pull_request = linkedById.get(link.github_pull_request_id);
      return pull_request ? [{ github_issue_id: link.github_issue_id, pull_request }] : [];
    }),
    assignmentSync: !syncState.error && !syncState.skipped && syncState.data[0]
      ? effectiveSyncState(syncState.data[0])
      : {
          status: "token_required",
          coverage: "app_repositories_only",
          phase: "issues",
          issue_status: "pending",
          pull_request_status: "pending",
          pages_checked: 0,
          issues_seen: openIssues.count! + closedIssues.count!,
          pull_request_pages_checked: 0,
          pull_requests_seen: openPullRequests.count! + mergedPullRequests.count! + closedPullRequests.count!,
          links_seen: links.data.length,
          last_completed_at: null,
          last_error: null,
          issue_last_error: null,
          pull_request_last_error: null,
        },
  };
}
