import { deleteSupabaseRows, selectSupabaseRows, upsertSupabaseRow } from "../supabase/server";
import { githubGraphQL } from "./api";
import { reconcileKnownScouterAssignments } from "./assignment-sync";

type Payload = Record<string, unknown>;
type Node = Record<string, unknown>;
type Connection = { nodes: Node[]; pageInfo: { hasNextPage: boolean } };

const prFields = `
  fullDatabaseId number title url state merged mergedAt closedAt createdAt updatedAt
  mergeable mergeStateStatus headRefName baseRefName
  author { login }
  repository { nameWithOwner }
`;

const prWithIssuesFields = `${prFields}
  closedIssues: closingIssuesReferences(first: 100) {
    nodes { fullDatabaseId number title url state createdAt closedAt updatedAt
      assignees(first: 20) { nodes { databaseId login } }
      labels(first: 20) { nodes { name } }
      repository { nameWithOwner }
    }
    pageInfo { hasNextPage }
  }
`;

const issueQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      fullDatabaseId number title url state createdAt closedAt updatedAt
      assignees(first: 20) { nodes { databaseId login } }
      labels(first: 20) { nodes { name } }
      linkedPrs: closedByPullRequestsReferences(first: 100, includeClosedPrs: true) {
        nodes { ${prFields} }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

const repositoryIssuesQuery = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issues(first: 12, states: [OPEN, CLOSED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        fullDatabaseId number title url state createdAt closedAt updatedAt
        assignees(first: 20) { nodes { databaseId login } }
        labels(first: 20) { nodes { name } }
        linkedPrs: closedByPullRequestsReferences(first: 20, includeClosedPrs: true) {
          nodes { ${prFields} }
          pageInfo { hasNextPage }
        }
      }
    }
  }
}`;

const prQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) { ${prWithIssuesFields} }
  }
}`;

export async function syncLinkedPullRequests(event: string, payload: Payload) {
  if (event === "push") {
    await syncPush(payload);
    return;
  }
  if (event !== "issues" && event !== "pull_request") return;
  const installation = object(payload.installation);
  const repository = object(payload.repository);
  const subject = object(payload[event === "issues" ? "issue" : "pull_request"]);
  const installationId = number(installation?.id);
  const fullName = string(repository?.full_name);
  const issueOrPrNumber = number(subject?.number);
  if (!installationId || !fullName || !issueOrPrNumber) return;
  await syncGitHubSubject({
    type: event,
    installationId,
    fullName,
    number: issueOrPrNumber,
  });
}

async function syncPush(payload: Payload) {
  const installationId = number(object(payload.installation)?.id);
  const fullName = string(object(payload.repository)?.full_name);
  const ref = string(payload.ref);
  if (!installationId || !fullName || !ref?.startsWith("refs/heads/")) return;
  const branch = ref.slice("refs/heads/".length);
  const links = await selectSupabaseRows<{ github_pull_request_id: number }>({
    table: "issue_pull_requests",
    query: { select: "github_pull_request_id", order: "updated_at.desc", limit: "200" },
  });
  if (links.error || links.skipped) throw new Error("Could not read linked PRs for push");
  const ids = [...new Set(links.data.map((link) => link.github_pull_request_id))];
  if (!ids.length) return;
  const prs = await selectSupabaseRows<{ url: string | null; github_pull_request_number: number }>({
    table: "pull_requests",
    query: {
      select: "url,github_pull_request_number",
      github_pull_request_id: `in.(${ids.join(",")})`,
      base_ref: `eq.${branch}`,
      state: "eq.open",
      limit: "20",
    },
  });
  if (prs.error || prs.skipped) throw new Error("Could not read PRs for push");
  for (const pr of prs.data) {
    if (!pr.url?.startsWith(`https://github.com/${fullName}/pull/`)) continue;
    await syncGitHubSubject({
      type: "pull_request",
      installationId,
      fullName,
      number: pr.github_pull_request_number,
    });
  }
}

export async function syncGitHubSubject({
  type,
  installationId,
  fullName,
  number: subjectNumber,
}: {
  type: "issues" | "pull_request";
  installationId: number;
  fullName: string;
  number: number;
}) {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) return;

  if (type === "issues") {
    const data = await githubGraphQL<{
      repository: { issue: Node | null } | null;
    }>(installationId, issueQuery, { owner, name, number: subjectNumber });
    const issue = data.repository?.issue;
    if (!issue) return;
    const issueId = string(issue.fullDatabaseId);
    const linkedPrs = issue.linkedPrs as Connection | null;
    if (!issueId || !linkedPrs) return;
    await storeIssue(issue);
    for (const pr of linkedPrs.nodes) {
      await storePr(pr);
    }
    await replaceLinks("github_issue_id", issueId, linkedPrs);
    return;
  }

  const data = await githubGraphQL<{
    repository: { pullRequest: Node | null } | null;
  }>(installationId, prQuery, { owner, name, number: subjectNumber });
  const pr = data.repository?.pullRequest;
  if (!pr) return;
  const prId = string(pr.fullDatabaseId);
  if (!prId) return;
  const issues = object(pr.closedIssues) as Connection | null;
  if (!issues) return;
  if (issues.nodes.length) {
    for (const issue of issues.nodes) await storeIssue(issue);
  }
  await storePr(pr);
  await replaceLinks("github_pull_request_id", prId, issues);
}

export async function syncRepositoryIssues(installationId: number, fullName: string) {
  const [owner, name] = fullName.split("/");
  if (!owner || !name) return 0;
  const data = await githubGraphQL<{
    repository: { issues: { nodes: Node[] } } | null;
  }>(installationId, repositoryIssuesQuery, { owner, name });
  if (!data.repository) throw new Error(`Repository ${fullName} is unavailable to this installation`);
  let checked = 0;
  for (const issue of data.repository?.issues.nodes ?? []) {
    const issueId = string(issue.fullDatabaseId);
    const linkedPrs = issue.linkedPrs as Connection | null;
    if (!issueId || !linkedPrs) continue;
    await storeIssue(issue);
    for (const pr of linkedPrs.nodes) await storePr(pr);
    await replaceLinks("github_issue_id", issueId, linkedPrs);
    checked++;
  }
  return checked;
}

async function replaceLinks(
  ownerColumn: "github_issue_id" | "github_pull_request_id",
  ownerId: string,
  connection: Connection,
) {
  if (!connection.pageInfo.hasNextPage) {
    const deleted = await deleteSupabaseRows({
      table: "issue_pull_requests",
      query: { [ownerColumn]: `eq.${ownerId}` },
    });
    if (!deleted.ok) throw new Error(`Could not clear old PR links: ${deleted.error}`);
  }
  for (const node of connection.nodes) {
    const linkedId = string(node.fullDatabaseId);
    if (!linkedId) continue;
    const row = ownerColumn === "github_issue_id"
      ? { github_issue_id: ownerId, github_pull_request_id: linkedId }
      : { github_issue_id: linkedId, github_pull_request_id: ownerId };
    const result = await upsertSupabaseRow({
      table: "issue_pull_requests",
      onConflict: "github_issue_id,github_pull_request_id",
      row: { ...row, updated_at: new Date().toISOString() },
    });
    if (!result.ok) throw new Error(`Could not store PR link: ${result.error}`);
  }
}

async function storePr(pr: Node) {
  const id = string(pr.fullDatabaseId);
  if (!id) return;
  const author = object(pr.author);
  const mergeable = string(pr.mergeable);
  const result = await upsertSupabaseRow({
    table: "pull_requests",
    onConflict: "github_pull_request_id",
    row: {
      github_pull_request_id: id,
      github_pull_request_number: pr.number,
      title: pr.title,
      state: string(pr.state)?.toLowerCase(),
      url: pr.url,
      author_login: author?.login ?? null,
      head_ref: pr.headRefName,
      base_ref: pr.baseRefName,
      merged: pr.merged,
      merged_at: pr.mergedAt,
      closed_at: pr.closedAt,
      opened_at: pr.createdAt,
      mergeable: mergeable === "MERGEABLE" ? true : mergeable === "CONFLICTING" ? false : null,
      mergeable_state: string(pr.mergeStateStatus)?.toLowerCase(),
      updated_at: pr.updatedAt,
    },
  });
  if (!result.ok) throw new Error(`Could not store PR state: ${result.error}`);
}

async function storeIssue(issue: Node) {
  const id = string(issue.fullDatabaseId);
  if (!id) return;
  const assignees = object(issue.assignees) as { nodes?: Node[] } | null;
  const labels = object(issue.labels) as { nodes?: Node[] } | null;
  const result = await upsertSupabaseRow({
    table: "issues",
    onConflict: "github_issue_id",
    row: {
      github_issue_id: id,
      github_issue_number: issue.number,
      title: issue.title,
      state: string(issue.state)?.toLowerCase(),
      url: issue.url,
      opened_at: issue.createdAt,
      closed_at: issue.closedAt,
      assignee_logins: (assignees?.nodes ?? []).map((node) => node.login),
      labels: (labels?.nodes ?? []).map((node) => node.name),
      updated_at: issue.updatedAt,
    },
  });
  if (!result.ok) throw new Error(`Could not store linked issue: ${result.error}`);
  await reconcileKnownScouterAssignments({
    githubIssueId: Number(id),
    assignees: (assignees?.nodes ?? []).flatMap((node) => {
      const accountId = number(node.databaseId);
      const login = string(node.login);
      return accountId && login ? [{ accountId, login }] : [];
    }),
    observedAt: string(issue.updatedAt) ?? new Date().toISOString(),
    source: "github_app",
  });
}

function object(value: unknown): Node | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Node : null;
}
function string(value: unknown): string | null {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}
function number(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
