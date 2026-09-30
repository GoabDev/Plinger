import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncRecentScouterWorkBatch } from "./assignment-sync";
import { fetchAssignedIssuesPage } from "./assigned-issue-search";
import { fetchAuthoredPullRequestsPage } from "./scouter-work-search";

const { from, upsert } = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../scouter/portal", () => ({ serviceClient: () => ({ from }), decryptPat: () => "test-token" }));
vi.mock("./api", () => ({ getGitHubTokenOwner: async () => ({ id: 1, login: "scouter" }) }));
vi.mock("./assigned-issue-search", () => ({ fetchAssignedIssuesPage: vi.fn() }));
vi.mock("./scouter-work-search", () => ({
  fetchAssignedIssueRelationships: async () => ({ pullRequests: [], links: [] }),
  fetchAuthoredPullRequestsPage: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  from.mockImplementation((table: string) => {
    const query = {
      select: () => query, not: () => query,
      limit: async () => ({ data: table === "scouter_profiles" ? [{ account_id: 1, account_login: "scouter", pat_ciphertext: "encrypted" }] : [], error: null }),
      upsert,
    };
    return query;
  });
  vi.mocked(fetchAssignedIssuesPage).mockResolvedValue({ issues: [], hasNextPage: false });
  vi.mocked(fetchAuthoredPullRequestsPage).mockResolvedValue({ issues: [], pullRequests: [], links: [], hasNextPage: false });
});

describe("monthly sync safety", () => {
  it("scans creation and closure windows without advancing history checkpoints or retiring assignments", async () => {
    const result = await syncRecentScouterWorkBatch({ month: "2024-02" });
    expect(result.completed).toBe(1);
    expect(result.pagesChecked).toBe(4);
    for (const search of [fetchAssignedIssuesPage, fetchAuthoredPullRequestsPage]) {
      expect(vi.mocked(search).mock.calls.map(([options]) => options.dateFilter)).toEqual([
        "created:2024-02-01..2024-02-29", "closed:2024-02-01..2024-02-29",
      ]);
      expect(vi.mocked(search).mock.calls.every(([options]) => options.updatedSince === undefined)).toBe(true);
    }
    expect(upsert).not.toHaveBeenCalled();
    expect(from.mock.calls.map(([table]) => table)).not.toContain("issue_assignments");
  });
});
