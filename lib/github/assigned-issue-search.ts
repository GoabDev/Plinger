const GITHUB_API_ORIGIN = "https://api.github.com";
export const ASSIGNED_ISSUES_PER_PAGE = 100;
const GITHUB_SEARCH_RESULT_LIMIT = 1_000;

export type GitHubUser = { id?: number; login?: string };
export type GitHubRepository = {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  default_branch?: string;
  archived?: boolean;
  disabled?: boolean;
  owner?: GitHubUser;
};
export type GitHubAssignedIssue = {
  id?: number;
  node_id?: string;
  number?: number;
  title?: string;
  state?: string;
  html_url?: string;
  repository_url?: string;
  created_at?: string;
  closed_at?: string | null;
  updated_at?: string;
  assignees?: GitHubUser[];
  labels?: Array<string | { name?: string }>;
  repository?: GitHubRepository;
};

type GitHubIssueSearchResponse = {
  total_count?: number;
  incomplete_results?: boolean;
  items?: GitHubAssignedIssue[];
};

type FetchLike = typeof fetch;

export function buildAssignedIssueSearchUrl(login: string, page: number, updatedSince?: string) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) {
    throw new Error("GitHub account login is invalid");
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("GitHub issue search page is invalid");
  }

  const url = new URL("/search/issues", GITHUB_API_ORIGIN);
  url.searchParams.set("q", `is:issue assignee:${login}${updatedSince ? ` updated:>=${searchTimestamp(updatedSince)}` : ""}`);
  url.searchParams.set("sort", updatedSince ? "updated" : "created");
  url.searchParams.set("order", updatedSince ? "desc" : "asc");
  url.searchParams.set("per_page", String(ASSIGNED_ISSUES_PER_PAGE));
  url.searchParams.set("page", String(page));
  return url;
}

export async function fetchAssignedIssuesPage({
  token,
  login,
  page,
  updatedSince,
  repositoryCache,
  fetchImpl = fetch,
}: {
  token: string;
  login: string;
  page: number;
  updatedSince?: string;
  repositoryCache: Map<string, GitHubRepository>;
  fetchImpl?: FetchLike;
}) {
  const headers = githubHeaders(token);
  const response = await fetchImpl(buildAssignedIssueSearchUrl(login, page, updatedSince), {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub assigned issue search: ${response.status}`);

  const result = await response.json() as GitHubIssueSearchResponse;
  if (!Number.isSafeInteger(result.total_count) || !Array.isArray(result.items)) {
    throw new Error("GitHub assigned issue search response is incomplete");
  }
  if (result.incomplete_results) {
    throw new Error("GitHub assigned issue search returned incomplete results");
  }
  if (result.total_count! > GITHUB_SEARCH_RESULT_LIMIT) {
    throw new Error(`GitHub assigned issue search exceeds ${GITHUB_SEARCH_RESULT_LIMIT} results`);
  }

  const repositoryUrls = [...new Set(result.items.map((issue) => issue.repository_url))];
  if (repositoryUrls.some((url) => !url)) {
    throw new Error("GitHub assigned issue response is missing repository details");
  }

  const missingUrls = repositoryUrls.filter((url): url is string => Boolean(url) && !repositoryCache.has(url!));
  for (let index = 0; index < missingUrls.length; index += 5) {
    const batch = missingUrls.slice(index, index + 5);
    const repositories = await Promise.all(batch.map(async (repositoryUrl) => {
      const safeUrl = parseRepositoryApiUrl(repositoryUrl);
      const repositoryResponse = await fetchImpl(safeUrl, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!repositoryResponse.ok) {
        throw new Error(`GitHub repository details: ${repositoryResponse.status}`);
      }
      return [repositoryUrl, await repositoryResponse.json() as GitHubRepository] as const;
    }));
    for (const [repositoryUrl, repository] of repositories) {
      if (!repository.id || !repository.name || !repository.full_name) {
        throw new Error("GitHub repository response is incomplete");
      }
      repositoryCache.set(repositoryUrl, repository);
    }
  }

  return {
    issues: result.items.map((issue) => ({
      ...issue,
      repository: repositoryCache.get(issue.repository_url!),
    })),
    hasNextPage: page * ASSIGNED_ISSUES_PER_PAGE < result.total_count!,
  };
}

function searchTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("GitHub issue search checkpoint is invalid");
  return new Date(timestamp).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function githubHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "Plinger",
  };
}

function parseRepositoryApiUrl(value: string) {
  const url = new URL(value);
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.origin !== GITHUB_API_ORIGIN || parts.length !== 3 || parts[0] !== "repos") {
    throw new Error("GitHub repository URL is invalid");
  }
  return url;
}
