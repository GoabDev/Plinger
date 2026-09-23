import "server-only";

import { randomUUID } from "node:crypto";
import { decryptPat, serviceClient } from "../scouter/portal";
import { getGitHubTokenOwner } from "./api";

type ScouterTokenRow = {
  account_id: number;
  account_login: string;
  pat_ciphertext: string;
};

type SyncStateRow = {
  account_id: number;
  status: "pending" | "syncing" | "complete" | "stale" | "token_required" | "failed";
  sync_run_id: string | null;
  next_page: number;
  pages_checked: number;
  issues_seen: number;
  last_completed_at: string | null;
  updated_at: string;
};

type GitHubUser = { id?: number; login?: string };
type GitHubRepository = {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  archived?: boolean;
  disabled?: boolean;
  owner?: GitHubUser;
};
type GitHubAssignedIssue = {
  id?: number;
  number?: number;
  title?: string;
  state?: string;
  html_url?: string;
  created_at?: string;
  closed_at?: string | null;
  updated_at?: string;
  assignees?: GitHubUser[];
  labels?: Array<string | { name?: string }>;
  repository?: GitHubRepository;
  pull_request?: unknown;
};

export type AssignmentSyncResult = {
  scoutersChecked: number;
  pagesChecked: number;
  issuesChecked: number;
  completed: number;
  failed: number;
};

export async function reconcileKnownScouterAssignments({
  githubIssueId,
  assignees,
  observedAt,
  source,
}: {
  githubIssueId: number;
  assignees: Array<{ accountId: number; login: string }>;
  observedAt: string;
  source: "github_app" | "webhook";
}) {
  const client = serviceClient();
  const { data: issue, error: issueError } = await client.from("issues")
    .select("id")
    .eq("github_issue_id", githubIssueId)
    .maybeSingle();
  if (issueError) throw issueError;
  if (!issue) return;

  const accountIds = assignees.map((assignee) => assignee.accountId);
  const { data: installations, error: installationError } = accountIds.length
    ? await client.from("github_installations")
      .select("account_id,account_login")
      .in("account_id", accountIds)
    : { data: [], error: null };
  if (installationError) throw installationError;

  const knownAssignments = (installations ?? []).flatMap((installation) => {
    const accountId = Number(installation.account_id);
    const assignee = assignees.find((item) => item.accountId === accountId);
    if (!assignee || !Number.isSafeInteger(accountId)) return [];
    return [{
      issue_id: issue.id,
      assignee_account_id: accountId,
      assignee_login: assignee.login || installation.account_login,
      active: true,
      unassigned_at: null,
      last_seen_at: observedAt,
      missed_complete_syncs: 0,
      source,
      updated_at: observedAt,
    }];
  });
  if (knownAssignments.length) {
    const { error } = await client.from("issue_assignments")
      .upsert(knownAssignments, { onConflict: "issue_id,assignee_account_id" });
    if (error) throw error;
  }

  const knownIds = new Set(knownAssignments.map((assignment) => assignment.assignee_account_id));
  const { data: activeAssignments, error: activeError } = await client.from("issue_assignments")
    .select("assignee_account_id")
    .eq("issue_id", issue.id)
    .eq("active", true);
  if (activeError) throw activeError;
  const removedIds = (activeAssignments ?? [])
    .map((assignment) => Number(assignment.assignee_account_id))
    .filter((accountId) => !knownIds.has(accountId));
  if (removedIds.length) {
    const { error } = await client.from("issue_assignments").update({
      active: false,
      unassigned_at: observedAt,
      updated_at: observedAt,
    }).eq("issue_id", issue.id).in("assignee_account_id", removedIds);
    if (error) throw error;
  }
}

export async function recordKnownScouterAssignmentEvent({
  githubIssueId,
  assignee,
  action,
  occurredAt,
}: {
  githubIssueId: number;
  assignee: { accountId: number; login: string };
  action: "assigned" | "unassigned";
  occurredAt: string;
}) {
  const client = serviceClient();
  const [{ data: issue, error: issueError }, { data: installation, error: installationError }] = await Promise.all([
    client.from("issues").select("id").eq("github_issue_id", githubIssueId).maybeSingle(),
    client.from("github_installations").select("account_id")
      .eq("account_id", assignee.accountId).limit(1).maybeSingle(),
  ]);
  if (issueError) throw issueError;
  if (installationError) throw installationError;
  if (!issue || !installation) return;
  const { error } = await client.from("issue_assignment_events").upsert({
    issue_id: issue.id,
    assignee_account_id: assignee.accountId,
    assignee_login: assignee.login,
    action,
    occurred_at: occurredAt,
    source: "webhook",
  }, { onConflict: "issue_id,assignee_account_id,action,occurred_at", ignoreDuplicates: true });
  if (error) throw error;
}

export async function syncScouterAssignmentsBatch({
  maxScouters = 1,
  maxPagesPerScouter = 5,
}: {
  maxScouters?: number;
  maxPagesPerScouter?: number;
} = {}): Promise<AssignmentSyncResult> {
  const client = serviceClient();
  const [{ data: profiles, error: profilesError }, { data: states, error: statesError }] = await Promise.all([
    client.from("scouter_profiles")
      .select("account_id,account_login,pat_ciphertext")
      .not("pat_ciphertext", "is", null)
      .limit(1000),
    client.from("scouter_issue_sync_state")
      .select("account_id,status,sync_run_id,next_page,pages_checked,issues_seen,last_completed_at,updated_at")
      .limit(1000),
  ]);
  if (profilesError) throw profilesError;
  if (statesError) throw statesError;

  const stateByAccount = new Map((states as SyncStateRow[] | null)?.map((state) => [Number(state.account_id), state]));
  const candidates = (profiles as ScouterTokenRow[] | null ?? [])
    .filter((profile) => profile.pat_ciphertext)
    .sort((left, right) => compareCandidates(left, right, stateByAccount))
    .slice(0, maxScouters);

  const result: AssignmentSyncResult = {
    scoutersChecked: 0,
    pagesChecked: 0,
    issuesChecked: 0,
    completed: 0,
    failed: 0,
  };

  for (const profile of candidates) {
    result.scoutersChecked++;
    try {
      const outcome = await syncScouterAssignments(profile, stateByAccount.get(Number(profile.account_id)) ?? null, maxPagesPerScouter);
      result.pagesChecked += outcome.pagesChecked;
      result.issuesChecked += outcome.issuesChecked;
      if (outcome.complete) result.completed++;
    } catch (error) {
      result.failed++;
      const message = error instanceof Error ? error.message : String(error);
      console.error("[github:assignment-sync:failed]", { accountId: profile.account_id, error });
      await client.from("scouter_issue_sync_state").upsert({
        account_id: profile.account_id,
        account_login: profile.account_login,
        status: "failed",
        coverage: "all_visible_repositories",
        last_error: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });
    }
  }

  return result;
}

async function syncScouterAssignments(
  profile: ScouterTokenRow,
  existing: SyncStateRow | null,
  maxPages: number,
) {
  const client = serviceClient();
  const resumed = existing?.status === "syncing" && existing.sync_run_id;
  const runId = resumed ? existing.sync_run_id! : randomUUID();
  let page = resumed ? existing.next_page : 1;
  let totalPages = resumed ? existing.pages_checked : 0;
  let totalIssues = resumed ? existing.issues_seen : 0;
  const startedAt = new Date().toISOString();

  const { error: startError } = await client.from("scouter_issue_sync_state").upsert({
    account_id: profile.account_id,
    account_login: profile.account_login,
    status: "syncing",
    coverage: "all_visible_repositories",
    sync_run_id: runId,
    next_page: page,
    pages_checked: totalPages,
    issues_seen: totalIssues,
    started_at: resumed ? undefined : startedAt,
    last_error: null,
    updated_at: startedAt,
  }, { onConflict: "account_id" });
  if (startError) throw startError;

  const pat = decryptPat(profile.pat_ciphertext);
  const tokenOwner = await getGitHubTokenOwner(pat);
  if (tokenOwner.id !== Number(profile.account_id)) {
    throw new Error(`GitHub token belongs to @${tokenOwner.login}, not @${profile.account_login}`);
  }
  let pagesChecked = 0;
  let issuesChecked = 0;
  while (pagesChecked < maxPages) {
    const response = await fetchAssignedIssuesPage(pat, page);
    const issues = response.issues.filter((issue) => !issue.pull_request);
    await storeAssignedIssuePage(profile, runId, issues);
    pagesChecked++;
    issuesChecked += issues.length;
    totalPages++;
    totalIssues += issues.length;

    if (!response.hasNextPage) {
      await completeSync(profile, runId, totalPages, totalIssues);
      return { pagesChecked, issuesChecked, complete: true };
    }

    page++;
    const { error } = await client.from("scouter_issue_sync_state").update({
      next_page: page,
      pages_checked: totalPages,
      issues_seen: totalIssues,
      updated_at: new Date().toISOString(),
    }).eq("account_id", profile.account_id).eq("sync_run_id", runId);
    if (error) throw error;
  }

  return { pagesChecked, issuesChecked, complete: false };
}

async function fetchAssignedIssuesPage(token: string, page: number) {
  const url = new URL("https://api.github.com/issues");
  url.searchParams.set("filter", "assigned");
  url.searchParams.set("state", "all");
  url.searchParams.set("sort", "created");
  url.searchParams.set("direction", "asc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "Plinger",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub assigned issues: ${response.status}`);
  return {
    issues: await response.json() as GitHubAssignedIssue[],
    hasNextPage: /<[^>]+>;\s*rel="next"/.test(response.headers.get("link") ?? ""),
  };
}

async function storeAssignedIssuePage(profile: ScouterTokenRow, runId: string, issues: GitHubAssignedIssue[]) {
  if (!issues.length) return;
  const client = serviceClient();
  const repositories = uniqueRepositories(issues);
  if (repositories.length) {
    const { error } = await client.from("repositories").upsert(repositories, { onConflict: "github_repository_id" });
    if (error) throw error;
  }

  const repositoryNames = repositories.map((repository) => repository.full_name);
  const { data: storedRepositories, error: repositoryError } = repositoryNames.length
    ? await client.from("repositories").select("id,full_name").in("full_name", repositoryNames)
    : { data: [], error: null };
  if (repositoryError) throw repositoryError;
  const repositoryByName = new Map((storedRepositories ?? []).map((repository) => [repository.full_name, repository.id]));

  const issueRows = issues.flatMap((issue) => {
    const repository = issue.repository;
    if (!issue.id || !issue.number || !issue.title || !issue.state || !repository?.full_name) return [];
    return [{
      repository_id: repositoryByName.get(repository.full_name) ?? null,
      github_issue_id: issue.id,
      github_issue_number: issue.number,
      title: issue.title,
      state: issue.state.toLowerCase(),
      url: issue.html_url ?? null,
      assignee_logins: (issue.assignees ?? []).flatMap((assignee) => assignee.login ? [assignee.login] : []),
      labels: (issue.labels ?? []).flatMap((label) => typeof label === "string" ? [label] : label.name ? [label.name] : []),
      opened_at: issue.created_at ?? null,
      closed_at: issue.closed_at ?? null,
      updated_at: issue.updated_at ?? new Date().toISOString(),
    }];
  });
  if (!issueRows.length) return;
  const { data: storedIssues, error: issueError } = await client.from("issues")
    .upsert(issueRows, { onConflict: "github_issue_id" })
    .select("id,github_issue_id");
  if (issueError) throw issueError;

  const now = new Date().toISOString();
  const assignments = (storedIssues ?? []).map((issue) => ({
    issue_id: issue.id,
    assignee_account_id: profile.account_id,
    assignee_login: profile.account_login,
    active: true,
    unassigned_at: null,
    last_seen_at: now,
    last_seen_sync_id: runId,
    missed_complete_syncs: 0,
    source: "scouter_token",
    updated_at: now,
  }));
  const { error: assignmentError } = await client.from("issue_assignments")
    .upsert(assignments, { onConflict: "issue_id,assignee_account_id" });
  if (assignmentError) throw assignmentError;
}

async function completeSync(profile: ScouterTokenRow, runId: string, pagesChecked: number, issuesSeen: number) {
  const client = serviceClient();
  const completedAt = new Date().toISOString();
  const { error: closeError } = await client.from("issue_assignments").update({
    active: false,
    unassigned_at: completedAt,
    missed_complete_syncs: 2,
    updated_at: completedAt,
  }).eq("assignee_account_id", profile.account_id)
    .eq("active", true)
    .neq("last_seen_sync_id", runId)
    .gte("missed_complete_syncs", 1);
  if (closeError) throw closeError;

  const { error: missError } = await client.from("issue_assignments").update({
    missed_complete_syncs: 1,
    updated_at: completedAt,
  }).eq("assignee_account_id", profile.account_id)
    .eq("active", true)
    .neq("last_seen_sync_id", runId)
    .eq("missed_complete_syncs", 0);
  if (missError) throw missError;

  const { error: stateError } = await client.from("scouter_issue_sync_state").update({
    status: "complete",
    coverage: "all_visible_repositories",
    sync_run_id: null,
    next_page: 1,
    pages_checked: pagesChecked,
    issues_seen: issuesSeen,
    last_completed_at: completedAt,
    last_error: null,
    updated_at: completedAt,
  }).eq("account_id", profile.account_id).eq("sync_run_id", runId);
  if (stateError) throw stateError;
}

function uniqueRepositories(issues: GitHubAssignedIssue[]) {
  const byId = new Map<number, Record<string, unknown>>();
  for (const issue of issues) {
    const repository = issue.repository;
    if (!repository?.id || !repository.name || !repository.full_name) continue;
    byId.set(repository.id, {
      github_repository_id: repository.id,
      owner_login: repository.owner?.login ?? repository.full_name.split("/")[0],
      name: repository.name,
      full_name: repository.full_name,
      private: repository.private ?? false,
      default_branch: repository.default_branch ?? null,
      archived: repository.archived ?? false,
      disabled: repository.disabled ?? false,
      updated_at: new Date().toISOString(),
    });
  }
  return [...byId.values()] as Array<Record<string, unknown> & { full_name: string }>;
}

function compareCandidates(
  left: ScouterTokenRow,
  right: ScouterTokenRow,
  states: Map<number, SyncStateRow>,
) {
  const leftState = states.get(Number(left.account_id));
  const rightState = states.get(Number(right.account_id));
  const priority = (state: SyncStateRow | undefined) => state?.status === "syncing"
    ? 0
    : !state || state.status === "pending" || state.status === "stale" || state.status === "token_required"
      ? 1
      : 2;
  const difference = priority(leftState) - priority(rightState);
  if (difference) return difference;
  const leftTime = leftState?.last_completed_at ?? leftState?.updated_at ?? "";
  const rightTime = rightState?.last_completed_at ?? rightState?.updated_at ?? "";
  return leftTime.localeCompare(rightTime);
}
