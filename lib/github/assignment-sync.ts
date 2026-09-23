import "server-only";

import { randomUUID } from "node:crypto";
import { decryptPat, serviceClient } from "../scouter/portal";
import { getGitHubTokenOwner } from "./api";
import {
  fetchAssignedIssuesPage,
  type GitHubAssignedIssue,
  type GitHubRepository,
} from "./assigned-issue-search";
import {
  fetchAssignedIssueRelationships,
  fetchAuthoredPullRequestsPage,
  type GitHubScouterPullRequest,
  type GitHubWorkLink,
} from "./scouter-work-search";

type WorkPhase = "issues" | "pull_requests";
type PhaseStatus = "pending" | "syncing" | "complete" | "failed";

type ScouterTokenRow = {
  account_id: number;
  account_login: string;
  pat_ciphertext: string;
};

type SyncStateRow = {
  account_id: number;
  status: "pending" | "syncing" | "complete" | "stale" | "token_required" | "failed";
  sync_run_id: string | null;
  phase: WorkPhase;
  next_page: number;
  pages_checked: number;
  issues_seen: number;
  issue_status: PhaseStatus;
  pull_request_status: PhaseStatus;
  pull_request_pages_checked: number;
  pull_requests_seen: number;
  links_seen: number;
  last_completed_at: string | null;
  updated_at: string;
};

export type AssignmentSyncResult = {
  scoutersChecked: number;
  pagesChecked: number;
  issuesChecked: number;
  pullRequestsChecked: number;
  linksChecked: number;
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
  concurrency = 1,
}: {
  maxScouters?: number | null;
  maxPagesPerScouter?: number;
  concurrency?: number;
} = {}): Promise<AssignmentSyncResult> {
  const client = serviceClient();
  const [{ data: profiles, error: profilesError }, { data: states, error: statesError }] = await Promise.all([
    client.from("scouter_profiles")
      .select("account_id,account_login,pat_ciphertext")
      .not("pat_ciphertext", "is", null)
      .limit(1000),
    client.from("scouter_issue_sync_state")
      .select("account_id,status,sync_run_id,phase,next_page,pages_checked,issues_seen,issue_status,pull_request_status,pull_request_pages_checked,pull_requests_seen,links_seen,last_completed_at,updated_at")
      .limit(1000),
  ]);
  if (profilesError) throw profilesError;
  if (statesError) throw statesError;

  const stateByAccount = new Map((states as SyncStateRow[] | null)?.map((state) => [Number(state.account_id), state]));
  const candidates = (profiles as ScouterTokenRow[] | null ?? [])
    .filter((profile) => profile.pat_ciphertext)
    .sort((left, right) => compareCandidates(left, right, stateByAccount));
  const selectedCandidates = maxScouters === null
    ? candidates
    : candidates.slice(0, maxScouters);
  const batchSize = Math.max(1, Math.min(5, Math.floor(concurrency)));

  const result: AssignmentSyncResult = {
    scoutersChecked: 0,
    pagesChecked: 0,
    issuesChecked: 0,
    pullRequestsChecked: 0,
    linksChecked: 0,
    completed: 0,
    failed: 0,
  };

  for (let index = 0; index < selectedCandidates.length; index += batchSize) {
    const outcomes = await Promise.all(selectedCandidates.slice(index, index + batchSize).map(async (profile) => {
      try {
        const outcome = await syncScouterWork(
          profile,
          stateByAccount.get(Number(profile.account_id)) ?? null,
          maxPagesPerScouter,
        );
        return { ...outcome, failed: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const phase = error instanceof ScouterWorkSyncError ? error.phase : "issues";
        console.error("[github:assignment-sync:failed]", { accountId: profile.account_id, error });
        await client.from("scouter_issue_sync_state").upsert({
          account_id: profile.account_id,
          account_login: profile.account_login,
          status: "failed",
          coverage: "all_visible_repositories",
          phase,
          ...(phase === "issues"
            ? { issue_status: "failed", issue_last_error: message.slice(0, 500) }
            : { pull_request_status: "failed", pull_request_last_error: message.slice(0, 500) }),
          last_error: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        }, { onConflict: "account_id" });
        return {
          pagesChecked: 0,
          issuesChecked: 0,
          pullRequestsChecked: 0,
          linksChecked: 0,
          complete: false,
          failed: true,
        };
      }
    }));

    for (const outcome of outcomes) {
      result.scoutersChecked++;
      result.pagesChecked += outcome.pagesChecked;
      result.issuesChecked += outcome.issuesChecked;
      result.pullRequestsChecked += outcome.pullRequestsChecked;
      result.linksChecked += outcome.linksChecked;
      if (outcome.complete) result.completed++;
      if (outcome.failed) result.failed++;
    }
  }

  return result;
}

async function syncScouterWork(
  profile: ScouterTokenRow,
  existing: SyncStateRow | null,
  maxPages: number,
) {
  const client = serviceClient();
  const resumed = existing?.status === "syncing" && existing.sync_run_id;
  const runId = resumed ? existing.sync_run_id! : randomUUID();
  let phase: WorkPhase = resumed ? existing.phase : "issues";
  let page = resumed ? existing.next_page : 1;
  let totalIssuePages = resumed ? existing.pages_checked : 0;
  let totalIssues = resumed ? existing.issues_seen : 0;
  let totalPullRequestPages = resumed ? existing.pull_request_pages_checked : 0;
  let totalPullRequests = resumed ? existing.pull_requests_seen : 0;
  let totalLinks = resumed ? existing.links_seen : 0;
  const startedAt = new Date().toISOString();

  const { error: startError } = await client.from("scouter_issue_sync_state").upsert({
    account_id: profile.account_id,
    account_login: profile.account_login,
    status: "syncing",
    coverage: "all_visible_repositories",
    sync_run_id: runId,
    phase,
    next_page: page,
    pages_checked: totalIssuePages,
    issues_seen: totalIssues,
    issue_status: phase === "issues" ? "syncing" : "complete",
    pull_request_status: phase === "pull_requests" ? "syncing" : "pending",
    pull_request_pages_checked: totalPullRequestPages,
    pull_requests_seen: totalPullRequests,
    links_seen: totalLinks,
    started_at: resumed ? undefined : startedAt,
    last_error: null,
    issue_last_error: null,
    pull_request_last_error: null,
    updated_at: startedAt,
  }, { onConflict: "account_id" });
  if (startError) throw startError;

  let pat: string;
  let tokenOwner: Awaited<ReturnType<typeof getGitHubTokenOwner>>;
  try {
    pat = decryptPat(profile.pat_ciphertext);
    tokenOwner = await getGitHubTokenOwner(pat);
    if (tokenOwner.id !== Number(profile.account_id)) {
      throw new Error(`GitHub token belongs to @${tokenOwner.login}, not @${profile.account_login}`);
    }
  } catch (error) {
    throw new ScouterWorkSyncError(phase, error);
  }
  const repositoryCache = new Map<string, GitHubRepository>();
  let pagesChecked = 0;
  let issuesChecked = 0;
  let pullRequestsChecked = 0;
  let linksChecked = 0;
  while (pagesChecked < maxPages) {
    try {
      if (phase === "issues") {
        const response = await fetchAssignedIssuesPage({
          token: pat,
          login: tokenOwner.login,
          page,
          repositoryCache,
        });
        const relationships = await fetchAssignedIssueRelationships({ token: pat, issues: response.issues });
        await storeAssignedIssuePage(profile, runId, response.issues);
        await storePullRequestsAndLinks({
          pullRequests: relationships.pullRequests,
          links: relationships.links,
          replaceIssueIds: response.issues.flatMap((issue) => issue.id ? [issue.id] : []),
        });
        pagesChecked++;
        issuesChecked += response.issues.length;
        pullRequestsChecked += relationships.pullRequests.length;
        linksChecked += relationships.links.length;
        totalIssuePages++;
        totalIssues += response.issues.length;
        totalLinks += relationships.links.length;

        if (!response.hasNextPage) {
          await completeIssuePhase(profile, runId, {
            issuesSeen: totalIssues,
            issuePagesChecked: totalIssuePages,
            pullRequestsSeen: totalPullRequests,
            linksSeen: totalLinks,
          });
          phase = "pull_requests";
          page = 1;
          continue;
        }

        page++;
        await updateProgress(profile, runId, {
          phase,
          nextPage: page,
          issuePagesChecked: totalIssuePages,
          issuesSeen: totalIssues,
          pullRequestPagesChecked: totalPullRequestPages,
          pullRequestsSeen: totalPullRequests,
          linksSeen: totalLinks,
        });
        continue;
      }

      const response = await fetchAuthoredPullRequestsPage({
        token: pat,
        login: tokenOwner.login,
        page,
      });
      await storeDiscoveredIssues(response.issues);
      await storePullRequestsAndLinks({
        pullRequests: response.pullRequests,
        links: response.links,
        replacePullRequestIds: response.pullRequests.map((pullRequest) => pullRequest.id),
      });
      pagesChecked++;
      issuesChecked += response.issues.length;
      pullRequestsChecked += response.pullRequests.length;
      linksChecked += response.links.length;
      totalPullRequestPages++;
      totalPullRequests += response.pullRequests.length;
      totalLinks += response.links.length;

      if (!response.hasNextPage) {
        await completeWorkSync(profile, runId, {
          issuesSeen: totalIssues,
          issuePagesChecked: totalIssuePages,
          pullRequestPagesChecked: totalPullRequestPages,
          pullRequestsSeen: totalPullRequests,
          linksSeen: totalLinks,
        });
        return { pagesChecked, issuesChecked, pullRequestsChecked, linksChecked, complete: true };
      }

      page++;
      await updateProgress(profile, runId, {
        phase,
        nextPage: page,
        issuePagesChecked: totalIssuePages,
        issuesSeen: totalIssues,
        pullRequestPagesChecked: totalPullRequestPages,
        pullRequestsSeen: totalPullRequests,
        linksSeen: totalLinks,
      });
    } catch (error) {
      throw new ScouterWorkSyncError(phase, error);
    }
  }

  return { pagesChecked, issuesChecked, pullRequestsChecked, linksChecked, complete: false };
}

async function storeAssignedIssuePage(profile: ScouterTokenRow, runId: string, issues: GitHubAssignedIssue[]) {
  if (!issues.length) return;
  const client = serviceClient();
  const storedIssues = await upsertIssues(issues);

  const now = new Date().toISOString();
  const assignments = storedIssues.map((issue) => ({
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
  if (!assignments.length) return;
  const { error: assignmentError } = await client.from("issue_assignments")
    .upsert(assignments, { onConflict: "issue_id,assignee_account_id" });
  if (assignmentError) throw assignmentError;
}

async function storeDiscoveredIssues(issues: GitHubAssignedIssue[]) {
  if (issues.length) await upsertIssues(issues);
}

async function upsertIssues(issues: GitHubAssignedIssue[]) {
  if (!issues.length) return [] as Array<{ id: string; github_issue_id: number }>;
  const client = serviceClient();
  const repositoryByName = await upsertRepositories(issues, []);
  const rows = issues.flatMap((issue) => {
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
  if (!rows.length) return [] as Array<{ id: string; github_issue_id: number }>;
  const { data, error } = await client.from("issues")
    .upsert(rows, { onConflict: "github_issue_id" })
    .select("id,github_issue_id");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; github_issue_id: number }>;
}

async function storePullRequestsAndLinks({
  pullRequests,
  links,
  replaceIssueIds = [],
  replacePullRequestIds = [],
}: {
  pullRequests: GitHubScouterPullRequest[];
  links: GitHubWorkLink[];
  replaceIssueIds?: number[];
  replacePullRequestIds?: number[];
}) {
  const client = serviceClient();
  if (pullRequests.length) {
    const repositoryByName = await upsertRepositories([], pullRequests);
    const rows = pullRequests.map((pullRequest) => ({
      repository_id: repositoryByName.get(pullRequest.repository.full_name!) ?? null,
      github_pull_request_id: pullRequest.id,
      github_pull_request_number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.state,
      url: pullRequest.html_url,
      author_login: pullRequest.user?.login ?? null,
      head_ref: pullRequest.head_ref,
      base_ref: pullRequest.base_ref,
      merged: pullRequest.merged,
      merged_at: pullRequest.merged_at,
      mergeable: pullRequest.mergeable,
      mergeable_state: pullRequest.mergeable_state,
      opened_at: pullRequest.created_at,
      closed_at: pullRequest.closed_at,
      updated_at: pullRequest.updated_at,
    }));
    const { error } = await client.from("pull_requests").upsert(rows, { onConflict: "github_pull_request_id" });
    if (error) throw error;
  }

  for (const githubIssueId of [...new Set(replaceIssueIds)]) {
    const { error } = await client.from("issue_pull_requests").delete().eq("github_issue_id", githubIssueId);
    if (error) throw error;
  }
  for (const githubPullRequestId of [...new Set(replacePullRequestIds)]) {
    const { error } = await client.from("issue_pull_requests").delete().eq("github_pull_request_id", githubPullRequestId);
    if (error) throw error;
  }
  const rows = [...new Map(links.map((link) => [
    `${link.githubIssueId}:${link.githubPullRequestId}`,
    {
      github_issue_id: link.githubIssueId,
      github_pull_request_id: link.githubPullRequestId,
      updated_at: new Date().toISOString(),
    },
  ])).values()];
  if (rows.length) {
    const { error } = await client.from("issue_pull_requests")
      .upsert(rows, { onConflict: "github_issue_id,github_pull_request_id" });
    if (error) throw error;
  }
}

async function upsertRepositories(
  issues: GitHubAssignedIssue[],
  pullRequests: GitHubScouterPullRequest[],
) {
  const client = serviceClient();
  const repositories = uniqueRepositories(issues, pullRequests);
  if (repositories.length) {
    const { error } = await client.from("repositories").upsert(repositories, { onConflict: "github_repository_id" });
    if (error) throw error;
  }
  const names = repositories.map((repository) => repository.full_name);
  const { data, error } = names.length
    ? await client.from("repositories").select("id,full_name").in("full_name", names)
    : { data: [], error: null };
  if (error) throw error;
  return new Map((data ?? []).map((repository) => [repository.full_name, repository.id]));
}

async function completeIssuePhase(
  profile: ScouterTokenRow,
  runId: string,
  totals: {
    issuesSeen: number;
    issuePagesChecked: number;
    pullRequestsSeen: number;
    linksSeen: number;
  },
) {
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
    phase: "pull_requests",
    next_page: 1,
    pages_checked: totals.issuePagesChecked,
    issues_seen: totals.issuesSeen,
    pull_requests_seen: totals.pullRequestsSeen,
    links_seen: totals.linksSeen,
    issue_status: "complete",
    pull_request_status: "syncing",
    issue_last_error: null,
    last_error: null,
    updated_at: completedAt,
  }).eq("account_id", profile.account_id).eq("sync_run_id", runId);
  if (stateError) throw stateError;
}

async function updateProgress(
  profile: ScouterTokenRow,
  runId: string,
  progress: {
    phase: WorkPhase;
    nextPage: number;
    issuePagesChecked: number;
    issuesSeen: number;
    pullRequestPagesChecked: number;
    pullRequestsSeen: number;
    linksSeen: number;
  },
) {
  const { error } = await serviceClient().from("scouter_issue_sync_state").update({
    phase: progress.phase,
    next_page: progress.nextPage,
    pages_checked: progress.issuePagesChecked,
    issues_seen: progress.issuesSeen,
    pull_request_pages_checked: progress.pullRequestPagesChecked,
    pull_requests_seen: progress.pullRequestsSeen,
    links_seen: progress.linksSeen,
    updated_at: new Date().toISOString(),
  }).eq("account_id", profile.account_id).eq("sync_run_id", runId);
  if (error) throw error;
}

async function completeWorkSync(
  profile: ScouterTokenRow,
  runId: string,
  totals: {
    issuesSeen: number;
    issuePagesChecked: number;
    pullRequestPagesChecked: number;
    pullRequestsSeen: number;
    linksSeen: number;
  },
) {
  const completedAt = new Date().toISOString();
  const { error } = await serviceClient().from("scouter_issue_sync_state").update({
    status: "complete",
    coverage: "all_visible_repositories",
    sync_run_id: null,
    phase: "issues",
    next_page: 1,
    pages_checked: totals.issuePagesChecked,
    issues_seen: totals.issuesSeen,
    issue_status: "complete",
    pull_request_status: "complete",
    pull_request_pages_checked: totals.pullRequestPagesChecked,
    pull_requests_seen: totals.pullRequestsSeen,
    links_seen: totals.linksSeen,
    last_completed_at: completedAt,
    last_error: null,
    issue_last_error: null,
    pull_request_last_error: null,
    updated_at: completedAt,
  }).eq("account_id", profile.account_id).eq("sync_run_id", runId);
  if (error) throw error;
}

function uniqueRepositories(
  issues: GitHubAssignedIssue[],
  pullRequests: GitHubScouterPullRequest[],
) {
  const byId = new Map<number, Record<string, unknown>>();
  for (const workItem of [...issues, ...pullRequests]) {
    const repository = workItem.repository;
    if (!repository?.id || !repository.name || !repository.full_name) continue;
    byId.set(repository.id, {
      github_repository_id: repository.id,
      owner_login: repository.owner?.login ?? repository.full_name.split("/")[0],
      name: repository.name,
      full_name: repository.full_name,
      private: repository.private ?? false,
      default_branch: repository.default_branch ?? null,
      archived: repository.archived ?? false,
      updated_at: new Date().toISOString(),
    });
  }
  return [...byId.values()] as Array<Record<string, unknown> & { full_name: string }>;
}

class ScouterWorkSyncError extends Error {
  constructor(public readonly phase: WorkPhase, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "ScouterWorkSyncError";
  }
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
