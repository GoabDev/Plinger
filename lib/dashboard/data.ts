import { selectAllSupabaseRows, selectSupabaseRows } from "../supabase/server";
import { getScouterDirectory } from "./scouters";

export type RepositoryRow = {
  id: string;
  github_repository_id: number;
  owner_login: string;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string | null;
  archived: boolean;
  disabled: boolean;
  updated_at: string;
};

export type IssueRow = {
  id: string;
  github_issue_id: number;
  github_issue_number: number;
  title: string;
  state: string;
  url: string | null;
  assignee_logins: string[];
  labels: string[];
  opened_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

export type PullRequestRow = {
  id: string;
  github_pull_request_id: number;
  github_pull_request_number: number;
  title: string;
  state: string;
  url: string | null;
  author_login: string | null;
  head_ref: string | null;
  base_ref: string | null;
  merged: boolean;
  merged_at: string | null;
  mergeable_state: string | null;
  mergeable: boolean | null;
  updated_at: string;
};

export type IssuePullRequestRow = {
  github_issue_id: number;
  github_pull_request_id: number;
};

export type WebhookEventRow = {
  id: string;
  delivery_id: string;
  event: string;
  action: string | null;
  repository_full_name: string | null;
  sender_login: string | null;
  received_at: string;
};

export type InstallationRow = {
  id: string;
  installation_id: number;
  account_login: string | null;
  account_type: string | null;
  target_type: string | null;
  updated_at: string;
};

export async function getDashboardData() {
  const linksPromise = selectAllSupabaseRows<IssuePullRequestRow>({
    table: "issue_pull_requests",
    query: {
      select: "github_issue_id,github_pull_request_id",
      order: "updated_at.desc,github_issue_id.asc,github_pull_request_id.asc",
    },
  });
  const repositoriesPromise = selectSupabaseRows<RepositoryRow>({
    table: "repositories",
    query: {
      select:
        "id,github_repository_id,owner_login,name,full_name,private,default_branch,archived,disabled,updated_at",
      order: "updated_at.desc",
      limit: "20",
    },
  });
  const openIssuesPromise = selectAllSupabaseRows<IssueRow>({
    table: "issues",
    query: {
      select:
        "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at",
      state: "eq.open",
      order: "updated_at.desc,github_issue_id.asc",
    },
  });
  const closedIssuesPromise = selectAllSupabaseRows<IssueRow>({
    table: "issues",
    query: {
      select: "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at",
      state: "eq.closed",
      order: "closed_at.desc.nullslast,github_issue_id.asc",
    },
  });
  const recentEventsPromise = selectSupabaseRows<WebhookEventRow>({
    table: "webhook_events",
    query: {
      select:
        "id,delivery_id,event,action,repository_full_name,sender_login,received_at",
      order: "received_at.desc",
      limit: "8",
    },
  });
  const installationsPromise = selectSupabaseRows<InstallationRow>({
    table: "github_installations",
    query: {
      select:
        "id,installation_id,account_login,account_type,target_type,updated_at",
      order: "updated_at.desc",
      limit: "6",
    },
  });
  const scoutersPromise = getScouterDirectory(true);
  const links = await linksPromise;
  const linkedPrIds = [...new Set(links.data.map((link) => String(link.github_pull_request_id)))];
  const linkedPullRequestsPromise = getLinkedPullRequests(linkedPrIds);
  const [
    repositories,
    openIssues,
    closedIssues,
    linkedPullRequests,
    recentEvents,
    installations,
    scouters,
  ] = await Promise.all([
    repositoriesPromise,
    openIssuesPromise,
    closedIssuesPromise,
    linkedPullRequestsPromise,
    recentEventsPromise,
    installationsPromise,
    scoutersPromise,
  ]);
  const openPullRequests = {
    ...linkedPullRequests,
    data: linkedPullRequests.data.filter((pr) => !pr.merged),
  };
  const mergedPullRequests = {
    ...linkedPullRequests,
    data: linkedPullRequests.data.filter((pr) => pr.merged),
  };

  return {
    repositories,
    openIssues,
    closedIssues,
    openPullRequests,
    mergedPullRequests,
    links,
    recentEvents,
    installations,
    scouters,
    hasSupabaseConfig:
      !repositories.skipped &&
      !openIssues.skipped &&
      !closedIssues.skipped &&
      !openPullRequests.skipped &&
      !mergedPullRequests.skipped &&
      !recentEvents.skipped &&
      !installations.skipped &&
      !links.skipped,
    errors: [
      repositories.error,
      openIssues.error,
      closedIssues.error,
      openPullRequests.error,
      mergedPullRequests.error,
      recentEvents.error,
      installations.error,
      links.error,
    ].filter((error): error is string => Boolean(error)),
  };
}

async function getLinkedPullRequests(ids: string[]) {
  const data: PullRequestRow[] = [];
  // Keep each IN filter small enough for a request URL, even with large GitHub IDs.
  for (let index = 0; index < ids.length; index += 100) {
    const batch = await selectAllSupabaseRows<PullRequestRow>({
      table: "pull_requests",
      query: {
        select: "id,github_pull_request_id,github_pull_request_number,title,state,url,author_login,head_ref,base_ref,merged,merged_at,mergeable,mergeable_state,updated_at",
        github_pull_request_id: `in.(${ids.slice(index, index + 100).join(",")})`,
        order: "updated_at.desc,github_pull_request_id.asc",
      },
    });
    if (batch.error || batch.skipped) return { ...batch, data: [] };
    data.push(...batch.data);
  }
  data.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.github_pull_request_id - b.github_pull_request_id);
  return { data, skipped: false, error: undefined };
}
