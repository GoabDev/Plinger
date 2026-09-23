import { describe, expect, it, vi } from "vitest";
import {
  buildAssignedIssueSearchUrl,
  fetchAssignedIssuesPage,
  type GitHubRepository,
} from "./assigned-issue-search";

describe("assigned issue search", () => {
  it("searches all GitHub issues assigned to the Scouter", () => {
    const url = buildAssignedIssueSearchUrl("GoabDev", 2);

    expect(url.origin).toBe("https://api.github.com");
    expect(url.pathname).toBe("/search/issues");
    expect(url.searchParams.get("q")).toBe("is:issue assignee:GoabDev");
    expect(url.searchParams.get("sort")).toBe("created");
    expect(url.searchParams.get("order")).toBe("asc");
    expect(url.searchParams.get("per_page")).toBe("100");
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("accepts GitHub logins containing numbers", () => {
    expect(buildAssignedIssueSearchUrl("thisismizz2", 1).searchParams.get("q"))
      .toBe("is:issue assignee:thisismizz2");
  });

  it("hydrates repository details and reuses them across pages", async () => {
    const repositoryUrl = "https://api.github.com/repos/DigiNodes/truthbounty-frontend";
    const repository: GitHubRepository = {
      id: 77,
      name: "truthbounty-frontend",
      full_name: "DigiNodes/truthbounty-frontend",
      private: false,
      default_branch: "main",
      archived: false,
      disabled: false,
      owner: { login: "DigiNodes" },
    };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        total_count: 101,
        incomplete_results: false,
        items: [{ id: 350, number: 350, repository_url: repositoryUrl }],
      }))
      .mockResolvedValueOnce(jsonResponse(repository))
      .mockResolvedValueOnce(jsonResponse({
        total_count: 101,
        incomplete_results: false,
        items: [{ id: 351, number: 351, repository_url: repositoryUrl }],
      }));
    const repositoryCache = new Map<string, GitHubRepository>();

    const first = await fetchAssignedIssuesPage({
      token: "github_pat_test",
      login: "GoabDev",
      page: 1,
      repositoryCache,
      fetchImpl,
    });
    const second = await fetchAssignedIssuesPage({
      token: "github_pat_test",
      login: "GoabDev",
      page: 2,
      repositoryCache,
      fetchImpl,
    });

    expect(first.issues[0].repository).toEqual(repository);
    expect(first.hasNextPage).toBe(true);
    expect(second.issues[0].repository).toEqual(repository);
    expect(second.hasNextPage).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("rejects incomplete searches so existing assignments are not removed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      total_count: 1,
      incomplete_results: true,
      items: [],
    }));

    await expect(fetchAssignedIssuesPage({
      token: "github_pat_test",
      login: "GoabDev",
      page: 1,
      repositoryCache: new Map(),
      fetchImpl,
    })).rejects.toThrow("incomplete results");
  });
});

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
