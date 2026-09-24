import type {
  GitHubAssignedIssue,
  GitHubRepository,
  GitHubUser,
} from "./assigned-issue-search";

const GITHUB_API_ORIGIN = "https://api.github.com";
const RESULTS_PER_PAGE = 100;
const SEARCH_RESULT_LIMIT = 1_000;
const GRAPHQL_BATCH_SIZE = 20;

type FetchLike = typeof fetch;
type GraphNode = Record<string, unknown>;
type GraphConnection = { nodes?: Array<GraphNode | null>; pageInfo?: { hasNextPage?: boolean } };

export type GitHubScouterPullRequest = {
  id: number;
  node_id: string;
  number: number;
  title: string;
  state: string;
  html_url: string;
  user: GitHubUser | null;
  head_ref: string | null;
  base_ref: string | null;
  merged: boolean;
  merged_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string;
  mergeable: boolean | null;
  mergeable_state: string | null;
  repository: GitHubRepository;
};

export type GitHubWorkLink = {
  githubIssueId: number;
  githubPullRequestId: number;
};

export function buildAuthoredPullRequestSearchUrl(login: string, page: number, updatedSince?: string) {
  validateLoginAndPage(login, page);
  const url = new URL("/search/issues", GITHUB_API_ORIGIN);
  url.searchParams.set("q", `is:pr author:${login}${updatedSince ? ` updated:>=${searchTimestamp(updatedSince)}` : ""}`);
  url.searchParams.set("sort", updatedSince ? "updated" : "created");
  url.searchParams.set("order", updatedSince ? "desc" : "asc");
  url.searchParams.set("per_page", String(RESULTS_PER_PAGE));
  url.searchParams.set("page", String(page));
  return url;
}

export async function fetchAssignedIssueRelationships({
  token,
  issues,
  fetchImpl = fetch,
}: {
  token: string;
  issues: GitHubAssignedIssue[];
  fetchImpl?: FetchLike;
}) {
  const nodeIds = issues.map((issue) => issue.node_id);
  if (nodeIds.some((nodeId) => !nodeId)) {
    throw new Error("GitHub assigned issue response is missing relationship identifiers");
  }

  const pullRequests = new Map<number, GitHubScouterPullRequest>();
  const links: GitHubWorkLink[] = [];
  for (const nodes of await fetchGraphNodes(token, nodeIds as string[], ISSUE_RELATIONSHIPS_QUERY, fetchImpl)) {
    for (const node of nodes) {
      if (node.__typename !== "Issue") throw new Error("GitHub issue relationship response is incomplete");
      const issueId = numericId(node.fullDatabaseId);
      const connection = graphConnection(node.linkedPullRequests);
      if (!issueId || !connection || connection.pageInfo?.hasNextPage) {
        throw new Error("GitHub issue relationship response is incomplete");
      }
      for (const linkedNode of connection.nodes ?? []) {
        if (!linkedNode) continue;
        const pullRequest = normalizePullRequest(linkedNode);
        pullRequests.set(pullRequest.id, pullRequest);
        links.push({ githubIssueId: issueId, githubPullRequestId: pullRequest.id });
      }
    }
  }

  return { pullRequests: [...pullRequests.values()], links };
}

export async function fetchAuthoredPullRequestsPage({
  token,
  login,
  page,
  updatedSince,
  fetchImpl = fetch,
}: {
  token: string;
  login: string;
  page: number;
  updatedSince?: string;
  fetchImpl?: FetchLike;
}) {
  const response = await fetchImpl(buildAuthoredPullRequestSearchUrl(login, page, updatedSince), {
    headers: githubHeaders(token),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub authored pull request search: ${response.status}`);
  const result = await response.json() as {
    total_count?: number;
    incomplete_results?: boolean;
    items?: Array<{ node_id?: string }>;
  };
  if (!Number.isSafeInteger(result.total_count) || !Array.isArray(result.items)) {
    throw new Error("GitHub authored pull request search response is incomplete");
  }
  if (result.incomplete_results) {
    throw new Error("GitHub authored pull request search returned incomplete results");
  }
  if (result.total_count! > SEARCH_RESULT_LIMIT) {
    throw new Error(`GitHub authored pull request search exceeds ${SEARCH_RESULT_LIMIT} results`);
  }
  const nodeIds = result.items.map((item) => item.node_id);
  if (nodeIds.some((nodeId) => !nodeId)) {
    throw new Error("GitHub authored pull request response is missing relationship identifiers");
  }

  const pullRequests: GitHubScouterPullRequest[] = [];
  const issues = new Map<number, GitHubAssignedIssue>();
  const links: GitHubWorkLink[] = [];
  for (const nodes of await fetchGraphNodes(token, nodeIds as string[], AUTHORED_PULL_REQUESTS_QUERY, fetchImpl)) {
    for (const node of nodes) {
      if (node.__typename !== "PullRequest") throw new Error("GitHub authored pull request response is incomplete");
      const pullRequest = normalizePullRequest(node);
      pullRequests.push(pullRequest);
      const connection = graphConnection(node.closingIssues);
      if (!connection || connection.pageInfo?.hasNextPage) {
        throw new Error("GitHub authored pull request relationship response is incomplete");
      }
      for (const linkedNode of connection.nodes ?? []) {
        if (!linkedNode) continue;
        const issue = normalizeIssue(linkedNode);
        issues.set(issue.id!, issue);
        links.push({ githubIssueId: issue.id!, githubPullRequestId: pullRequest.id });
      }
    }
  }

  return {
    pullRequests,
    issues: [...issues.values()],
    links,
    hasNextPage: page * RESULTS_PER_PAGE < result.total_count!,
  };
}

function searchTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("GitHub pull request search checkpoint is invalid");
  return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function fetchGraphNodes(
  token: string,
  nodeIds: string[],
  query: string,
  fetchImpl: FetchLike,
) {
  const batches: GraphNode[][] = [];
  for (let index = 0; index < nodeIds.length; index += GRAPHQL_BATCH_SIZE) {
    const response = await fetchImpl(`${GITHUB_API_ORIGIN}/graphql`, {
      method: "POST",
      headers: { ...githubHeaders(token), "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { ids: nodeIds.slice(index, index + GRAPHQL_BATCH_SIZE) } }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`GitHub Scouter work GraphQL: ${response.status}`);
    const result = await response.json() as {
      data?: { nodes?: Array<GraphNode | null> };
      errors?: Array<{ message?: string }>;
    };
    if (result.errors?.length || !Array.isArray(result.data?.nodes)) {
      throw new Error(result.errors?.map((error) => error.message).filter(Boolean).join("; ") || "GitHub Scouter work GraphQL response is incomplete");
    }
    if (result.data.nodes.length !== Math.min(GRAPHQL_BATCH_SIZE, nodeIds.length - index) || result.data.nodes.some((node) => !node)) {
      throw new Error("GitHub Scouter work GraphQL response is incomplete");
    }
    batches.push(result.data.nodes as GraphNode[]);
  }
  return batches;
}

function normalizePullRequest(node: GraphNode): GitHubScouterPullRequest {
  const id = numericId(node.fullDatabaseId);
  const number = numericId(node.number);
  const repository = normalizeRepository(object(node.repository));
  const title = text(node.title);
  const url = text(node.url);
  const state = text(node.state);
  const nodeId = text(node.id);
  const updatedAt = text(node.updatedAt);
  if (!id || !number || !repository || !title || !url || !state || !nodeId || !updatedAt) {
    throw new Error("GitHub pull request response is incomplete");
  }
  const author = object(node.author);
  const mergeable = text(node.mergeable);
  return {
    id,
    node_id: nodeId,
    number,
    title,
    state: state.toLowerCase(),
    html_url: url,
    user: author ? { login: text(author.login) ?? undefined } : null,
    head_ref: text(node.headRefName),
    base_ref: text(node.baseRefName),
    merged: node.merged === true,
    merged_at: text(node.mergedAt),
    closed_at: text(node.closedAt),
    created_at: text(node.createdAt),
    updated_at: updatedAt,
    mergeable: mergeable === "MERGEABLE" ? true : mergeable === "CONFLICTING" ? false : null,
    mergeable_state: text(node.mergeStateStatus)?.toLowerCase() ?? null,
    repository,
  };
}

function normalizeIssue(node: GraphNode): GitHubAssignedIssue {
  const id = numericId(node.fullDatabaseId);
  const number = numericId(node.number);
  const repository = normalizeRepository(object(node.repository));
  const title = text(node.title);
  const url = text(node.url);
  const state = text(node.state);
  const nodeId = text(node.id);
  const updatedAt = text(node.updatedAt);
  if (!id || !number || !repository || !title || !url || !state || !nodeId || !updatedAt) {
    throw new Error("GitHub linked issue response is incomplete");
  }
  return {
    id,
    node_id: nodeId,
    number,
    title,
    state: state.toLowerCase(),
    html_url: url,
    created_at: text(node.createdAt) ?? undefined,
    closed_at: text(node.closedAt),
    updated_at: updatedAt,
    assignees: graphConnection(node.assignees)?.nodes?.flatMap((assignee) => {
      if (!assignee) return [];
      const login = text(assignee.login);
      const accountId = numericId(assignee.databaseId);
      return login ? [{ login, ...(accountId ? { id: accountId } : {}) }] : [];
    }) ?? [],
    labels: graphConnection(node.labels)?.nodes?.flatMap((label) => {
      const name = label ? text(label.name) : null;
      return name ? [{ name }] : [];
    }) ?? [],
    repository,
  };
}

function normalizeRepository(node: GraphNode | null): GitHubRepository | null {
  if (!node) return null;
  const id = numericId(node.databaseId);
  const name = text(node.name);
  const fullName = text(node.nameWithOwner);
  if (!id || !name || !fullName) return null;
  const owner = object(node.owner);
  const defaultBranch = object(node.defaultBranchRef);
  return {
    id,
    name,
    full_name: fullName,
    private: node.isPrivate === true,
    default_branch: text(defaultBranch?.name) ?? undefined,
    archived: node.isArchived === true,
    disabled: node.isDisabled === true,
    owner: { login: text(owner?.login) ?? fullName.split("/")[0] },
  };
}

function validateLoginAndPage(login: string, page: number) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {
    throw new Error("GitHub account login is invalid");
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("GitHub work search page is invalid");
  }
}

function githubHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "Plinger",
  };
}

function graphConnection(value: unknown): GraphConnection | null {
  const node = object(value);
  return node && Array.isArray(node.nodes) ? node as GraphConnection : null;
}

function object(value: unknown): GraphNode | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as GraphNode : null;
}

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function numericId(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

const REPOSITORY_FIELDS = `
  databaseId name nameWithOwner isPrivate isArchived isDisabled
  defaultBranchRef { name }
  owner { login }
`;

const ISSUE_FIELDS = `
  id fullDatabaseId number title url state createdAt closedAt updatedAt
  assignees(first: 100) { nodes { databaseId login } }
  labels(first: 100) { nodes { name } }
  repository { ${REPOSITORY_FIELDS} }
`;

const PULL_REQUEST_FIELDS = `
  id fullDatabaseId number title url state merged mergedAt closedAt createdAt updatedAt
  mergeable mergeStateStatus headRefName baseRefName
  author { login }
  repository { ${REPOSITORY_FIELDS} }
`;

const ISSUE_RELATIONSHIPS_QUERY = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on Issue {
      id fullDatabaseId
      linkedPullRequests: closedByPullRequestsReferences(first: 100, includeClosedPrs: true) {
        nodes { ${PULL_REQUEST_FIELDS} }
        pageInfo { hasNextPage }
      }
    }
  }
}`;

const AUTHORED_PULL_REQUESTS_QUERY = `query($ids: [ID!]!) {
  nodes(ids: $ids) {
    __typename
    ... on PullRequest {
      ${PULL_REQUEST_FIELDS}
      closingIssues: closingIssuesReferences(first: 100) {
        nodes { ${ISSUE_FIELDS} }
        pageInfo { hasNextPage }
      }
    }
  }
}`;
