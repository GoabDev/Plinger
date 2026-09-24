import { describe, expect, it, vi } from "vitest";
import {
  buildAuthoredPullRequestSearchUrl,
  fetchAssignedIssueRelationships,
  fetchAuthoredPullRequestsPage,
} from "./scouter-work-search";

describe("Scouter work search", () => {
  it("builds a global authored pull request search", () => {
    const url = buildAuthoredPullRequestSearchUrl("GoabDev", 3);

    expect(url.pathname).toBe("/search/issues");
    expect(url.searchParams.get("q")).toBe("is:pr author:GoabDev");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("per_page")).toBe("100");
  });

  it("searches recently updated authored pull requests", () => {
    const url = buildAuthoredPullRequestSearchUrl("GoabDev", 1, "2026-09-23T23:40:00Z");
    expect(url.searchParams.get("q")).toBe("is:pr author:GoabDev updated:>=2026-09-23T23:40:00Z");
    expect(url.searchParams.get("sort")).toBe("updated");
    expect(url.searchParams.get("order")).toBe("desc");
  });

  it("hydrates authored PRs and their closing issues", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        total_count: 1,
        incomplete_results: false,
        items: [{ node_id: "PR_node_454" }],
      }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          nodes: [{
            __typename: "PullRequest",
            ...pullRequestNode(),
            closingIssues: {
              nodes: [issueNode()],
              pageInfo: { hasNextPage: false },
            },
          }],
        },
      }));

    const result = await fetchAuthoredPullRequestsPage({
      token: "github_pat_test",
      login: "GoabDev",
      page: 1,
      fetchImpl,
    });

    expect(result.pullRequests).toHaveLength(1);
    expect(result.pullRequests[0]).toMatchObject({ id: 4617397234, number: 454, state: "open" });
    expect(result.issues[0]).toMatchObject({ id: 5375913318, number: 350, state: "open" });
    expect(result.links).toEqual([{
      githubIssueId: 5375913318,
      githubPullRequestId: 4617397234,
    }]);
    expect(result.hasNextPage).toBe(false);
  });

  it("hydrates linked PRs from assigned issues", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        nodes: [{
          __typename: "Issue",
          id: "I_node_350",
          fullDatabaseId: "5375913318",
          linkedPullRequests: {
            nodes: [pullRequestNode()],
            pageInfo: { hasNextPage: false },
          },
        }],
      },
    }));

    const result = await fetchAssignedIssueRelationships({
      token: "github_pat_test",
      issues: [{ id: 5375913318, node_id: "I_node_350" }],
      fetchImpl,
    });

    expect(result.pullRequests[0]).toMatchObject({ id: 4617397234, number: 454 });
    expect(result.links).toEqual([{
      githubIssueId: 5375913318,
      githubPullRequestId: 4617397234,
    }]);
  });

  it("rejects paginated relationship data before reconciliation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        nodes: [{
          __typename: "Issue",
          id: "I_node_350",
          fullDatabaseId: "5375913318",
          linkedPullRequests: { nodes: [], pageInfo: { hasNextPage: true } },
        }],
      },
    }));

    await expect(fetchAssignedIssueRelationships({
      token: "github_pat_test",
      issues: [{ id: 5375913318, node_id: "I_node_350" }],
      fetchImpl,
    })).rejects.toThrow("incomplete");
  });
});

function repositoryNode() {
  return {
    databaseId: 1136530979,
    name: "truthbounty-frontend",
    nameWithOwner: "DigiNodes/truthbounty-frontend",
    isPrivate: false,
    isArchived: false,
    isDisabled: false,
    defaultBranchRef: { name: "main" },
    owner: { login: "DigiNodes" },
  };
}

function pullRequestNode() {
  return {
    id: "PR_node_454",
    fullDatabaseId: "4617397234",
    number: 454,
    title: "chore: isolate test fixtures and wallet mocks from production",
    url: "https://github.com/DigiNodes/truthbounty-frontend/pull/454",
    state: "OPEN",
    merged: false,
    mergedAt: null,
    closedAt: null,
    createdAt: "2026-09-23T15:00:00Z",
    updatedAt: "2026-09-23T19:04:08Z",
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    headRefName: "fix/350-isolate-test-fixtures",
    baseRefName: "main",
    author: { login: "GoabDev" },
    repository: repositoryNode(),
  };
}

function issueNode() {
  return {
    id: "I_node_350",
    fullDatabaseId: "5375913318",
    number: 350,
    title: "V2-FE-087 — Isolate Test Fixtures and Wallet Mocks from Production",
    url: "https://github.com/DigiNodes/truthbounty-frontend/issues/350",
    state: "OPEN",
    createdAt: "2026-09-07T00:00:00Z",
    closedAt: null,
    updatedAt: "2026-09-23T19:04:08Z",
    assignees: { nodes: [{ databaseId: 245244525, login: "GoabDev" }] },
    labels: { nodes: [{ name: "frontend" }] },
    repository: repositoryNode(),
  };
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
