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
};

const scouterSelect = "id,installation_id,account_id,account_login,suspended_at,uninstalled_at,created_at";
const issueSelect = "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at";
const pullRequestSelect = "id,github_pull_request_id,github_pull_request_number,title,state,url,author_login,head_ref,base_ref,merged,merged_at,mergeable,mergeable_state,updated_at";
const repositorySelect = "id,github_repository_id,owner_login,name,full_name,private,default_branch,archived,disabled,updated_at";
const eventSelect = "id,delivery_id,event,action,repository_full_name,sender_login,received_at";

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

  const assigned = `cs.{${scouter.account_login}}`;
  const [repositories, openIssues, closedIssues, openPullRequests, mergedPullRequests, closedPullRequests, activity] = await Promise.all([
    selectSupabaseRows<RepositoryRow>({
      table: "repositories",
      query: { select: repositorySelect, owner_login: `eq.${scouter.account_login}`, disabled: "eq.false", order: "updated_at.desc", limit: "20" },
      count: "exact",
    }),
    selectSupabaseRows<IssueRow>({
      table: "issues",
      query: { select: issueSelect, assignee_logins: assigned, state: "eq.open", order: "updated_at.desc", limit: "20" },
      count: "exact",
    }),
    selectSupabaseRows<IssueRow>({
      table: "issues",
      query: { select: issueSelect, assignee_logins: assigned, state: "eq.closed", order: "closed_at.desc.nullslast", limit: "20" },
      count: "exact",
    }),
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
  };
}
