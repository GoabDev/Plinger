import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardData } from "./data";

vi.mock("./scouters", () => ({
  getScouterDirectory: vi.fn(async () => ({ data: [], count: 0 })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("dashboard work coverage", () => {
  it("loads beyond the old issue/link caps and the API row cap, including older linked PRs", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    const issues = Array.from({ length: 1205 }, (_, i) => ({
      github_issue_id: i + 1, state: "open",
    }));
    const closed = Array.from({ length: 25 }, (_, i) => ({ github_issue_id: i + 2000, state: "closed" }));
    const links = Array.from({ length: 241 }, (_, i) => ({
      github_issue_id: i + 1, github_pull_request_id: i + 3000,
    }));
    const prs = links.map((link, i) => ({
      github_pull_request_id: link.github_pull_request_id,
      state: i % 3 === 0 ? "closed" : "open",
      merged: i % 3 === 0,
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
    }));
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      let rows: unknown[] = [];
      if (table === "issues") rows = url.searchParams.get("state") === "eq.open" ? issues : closed;
      if (table === "issue_pull_requests") rows = links;
      if (table === "pull_requests") {
        const filter = url.searchParams.get("github_pull_request_id")!;
        const ids = filter.slice(4, -1).split(",").map(Number);
        expect(ids.length).toBeLessThanOrEqual(100);
        rows = prs.filter((pr) => ids.includes(pr.github_pull_request_id));
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      // A server may return fewer rows than requested; this must not end pagination.
      const limit = Math.min(73, Number(url.searchParams.get("limit")));
      return new Response(JSON.stringify(rows.slice(offset, offset + limit)), {
        headers: { "content-range": `${offset}-${offset + limit - 1}/${rows.length}` },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDashboardData();

    expect(result.openIssues.data).toHaveLength(1205);
    expect(result.closedIssues.data).toHaveLength(25);
    expect(result.links.data).toHaveLength(241);
    expect(result.openPullRequests.data.length + result.mergedPullRequests.data.length).toBe(241);
    expect(result.mergedPullRequests.data.some((pr) => pr.github_pull_request_id === 3240)).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports a later-page failure instead of showing a partial list as complete", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/issues") && url.searchParams.get("state") === "eq.open") {
        if (url.searchParams.get("offset") === "0") {
          return new Response(JSON.stringify([{ github_issue_id: 1 }]), { headers: { "content-range": "0-0/2" } });
        }
        return new Response("Database unavailable", { status: 503 });
      }
      return new Response("[]", { headers: { "content-range": "*/0" } });
    }));
    const result = await getDashboardData();
    expect(result.openIssues.data).toEqual([]);
    expect(result.errors).toContain("Database unavailable");
  });
});
