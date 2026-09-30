import { currentMonth, monthQuery, monthBounds, inActivityMonth } from "../activity-month";
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
  opened_at?: string | null;
  closed_at?: string | null;
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

export async function getDashboardData(month = currentMonth()) {
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
      ...monthQuery(month, "opened_at"),
      order: "updated_at.desc,github_issue_id.asc",
    },
  });
  const closedIssuesPromise = selectAllSupabaseRows<IssueRow>({
    table: "issues",
    query: {
      select: "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at",
      state: "eq.closed",
      ...monthQuery(month, "closed_at"),
      order: "closed_at.desc.nullslast,github_issue_id.asc",
    },
  });
  const recentEventsPromise = selectSupabaseRows<WebhookEventRow>({
    table: "webhook_events",
    query: {
      select:
        "id,delivery_id,event,action,repository_full_name,sender_login,received_at",
      ...monthQuery(month, "received_at"),
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
  const pullRequestsPromise = selectAllSupabaseRows<PullRequestRow>({
    table: "pull_requests",
    query: {
      select: "id,github_pull_request_id,github_pull_request_number,title,state,url,author_login,head_ref,base_ref,merged,merged_at,opened_at,closed_at,mergeable,mergeable_state,updated_at",
      ...(month === "all" ? {} : { or: ["opened_at", "closed_at", "merged_at"].map((column) => {
        const { start, end } = monthBounds(month);
        return `and(${column}.gte.${start},${column}.lt.${end})`;
      }).join(",").replace(/^(.+)$/, "($1)") }),
      order: "updated_at.desc,github_pull_request_id.asc",
    },
  });
  const linksPromise = month === "all"
    ? loadWorkLinks()
    : Promise.all([openIssuesPromise, closedIssuesPromise, pullRequestsPromise]).then(async ([open, closed, prs]) => {
      const filters = [
        ...new Set([...open.data, ...closed.data].map((issue) => `github_issue_id.eq.${issue.github_issue_id}`)),
        ...new Set(prs.data.map((pr) => `github_pull_request_id.eq.${pr.github_pull_request_id}`)),
      ];
      const links = new Map<string, IssuePullRequestRow>();
      for (let offset = 0; offset < filters.length; offset += 100) {
        const result = await loadWorkLinks({ or: `(${filters.slice(offset, offset + 100).join(",")})` });
        if (result.error || result.skipped) return { ...result, data: [] };
        for (const link of result.data) links.set(`${link.github_issue_id}:${link.github_pull_request_id}`, link);
      }
      return { data: [...links.values()], error: undefined, skipped: Boolean(open.skipped || closed.skipped || prs.skipped) };
    });
  const [
    repositories,
    openIssues,
    closedIssues,
    pullRequests,
    recentEvents,
    installations,
    scouters,
    links,
  ] = await Promise.all([
    repositoriesPromise,
    openIssuesPromise,
    closedIssuesPromise,
    pullRequestsPromise,
    recentEventsPromise,
    installationsPromise,
    scoutersPromise,
    linksPromise,
  ]);
  // Related work is context, not an entry in the selected month's lists.
  // Keeping it separate prevents the period filter from hiding genuine GitHub links.
  const issueIds = new Set([...openIssues.data, ...closedIssues.data].map((issue) => issue.github_issue_id));
  const prIds = new Set(pullRequests.data
    .filter((pr) => inActivityMonth(pr.merged ? pr.merged_at : pr.state === "closed" ? pr.closed_at : pr.opened_at, month))
    .map((pr) => pr.github_pull_request_id));
  const [relatedIssues, relatedPullRequests] = await Promise.all([
    loadRelatedRows<IssueRow>("issues", "github_issue_id", links.data.map((link) => link.github_issue_id).filter((id) => !issueIds.has(id)),
      "id,github_issue_id,github_issue_number,title,state,url,assignee_logins,labels,opened_at,closed_at,updated_at"),
    loadRelatedRows<PullRequestRow>("pull_requests", "github_pull_request_id", links.data.map((link) => link.github_pull_request_id).filter((id) => !prIds.has(id)),
      "id,github_pull_request_id,github_pull_request_number,title,state,url,author_login,head_ref,base_ref,merged,merged_at,opened_at,closed_at,mergeable,mergeable_state,updated_at"),
  ]);
  const openPullRequests = {
    ...pullRequests,
    data: pullRequests.data.filter((pr) => !pr.merged && inActivityMonth(pr.state === "closed" ? pr.closed_at : pr.opened_at, month)),
  };
  const mergedPullRequests = {
    ...pullRequests,
    data: pullRequests.data.filter((pr) => pr.merged && inActivityMonth(pr.merged_at, month)),
  };

  return {
    repositories,
    openIssues,
    closedIssues,
    openPullRequests,
    mergedPullRequests,
    links,
    relatedIssues,
    relatedPullRequests,
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
      relatedIssues.error,
      relatedPullRequests.error,
    ].filter((error): error is string => Boolean(error)),
  };
}

async function loadRelatedRows<T>(table: string, column: string, ids: number[], select: string) {
  const uniqueIds = [...new Set(ids)];
  const data: T[] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const result = await selectAllSupabaseRows<T>({
      table,
      query: { select, [column]: `in.(${uniqueIds.slice(offset, offset + 100).join(",")})`, order: `${column}.asc` },
    });
    if (result.error || result.skipped) return { ...result, data: [] };
    data.push(...result.data);
  }
  return { data, error: undefined, skipped: false };
}

function loadWorkLinks(query: Record<string, string> = {}) {
  return selectAllSupabaseRows<IssuePullRequestRow>({
    table: "issue_pull_requests",
    query: {
      select: "github_issue_id,github_pull_request_id",
      order: "updated_at.desc,github_issue_id.asc,github_pull_request_id.asc",
      ...query,
    },
  });
}
