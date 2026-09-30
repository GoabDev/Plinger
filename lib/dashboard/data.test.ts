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
  it("retains older linked PRs as issue context without adding them to the month's PR list", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      let rows: unknown[] = [];
      if (table === "issues" && url.searchParams.get("state") === "eq.open") rows = [{ github_issue_id: 1 }];
      if (table === "issue_pull_requests") {
        expect(url.searchParams.get("or")).toBe("(github_issue_id.eq.1)");
        rows = [{ github_issue_id: 1, github_pull_request_id: 9 }];
      }
      if (table === "pull_requests" && url.searchParams.has("github_pull_request_id")) {
        expect(url.searchParams.get("github_pull_request_id")).toBe("in.(9)");
        expect(url.searchParams.has("or")).toBe(false);
        rows = [{ github_pull_request_id: 9, opened_at: "2026-08-01T00:00:00Z", state: "open", merged: false }];
      }
      return new Response(JSON.stringify(rows), { headers: { "content-range": `*/${rows.length}` } });
    }));
    const result = await getDashboardData("2026-09");
    expect(result.openPullRequests.data).toEqual([]);
    expect(result.relatedPullRequests.data.map((pr) => pr.github_pull_request_id)).toEqual([9]);
    expect(result.links.data).toEqual([{ github_issue_id: 1, github_pull_request_id: 9 }]);
  });

  it("filters by creation, closure and merge dates instead of the latest update date", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      let rows: unknown[] = [];
      if (table === "issues") {
        const column = url.searchParams.get("state") === "eq.open" ? "opened_at" : "closed_at";
        expect(url.searchParams.get("and")).toBe(`(${column}.gte.2026-09-01T00:00:00.000Z,${column}.lt.2026-10-01T00:00:00.000Z)`);
      }
      if (table === "webhook_events") expect(url.searchParams.get("and")).toContain("received_at.gte.2026-09-01");
      if (table === "pull_requests") {
        expect(url.searchParams.get("or")).toContain("and(merged_at.gte.2026-09-01");
        rows = [
          { github_pull_request_id: 1, state: "open", merged: false, opened_at: "2026-09-01T00:00:00Z" },
          { github_pull_request_id: 2, state: "closed", merged: true, opened_at: "2025-01-01T00:00:00Z", merged_at: "2026-09-30T23:59:59Z" },
          { github_pull_request_id: 3, state: "closed", merged: false, opened_at: "2025-01-01T00:00:00Z", closed_at: "2026-09-10T00:00:00Z" },
          { github_pull_request_id: 4, state: "closed", merged: true, opened_at: "2026-09-01T00:00:00Z", merged_at: "2026-10-01T00:00:00Z" },
        ];
      }
      return new Response(JSON.stringify(rows), { headers: { "content-range": `*/${rows.length}` } });
    }));
    const result = await getDashboardData("2026-09");
    expect(result.openPullRequests.data.map((pr) => pr.github_pull_request_id)).toEqual([1, 3]);
    expect(result.mergedPullRequests.data.map((pr) => pr.github_pull_request_id)).toEqual([2]);
  });

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
    // PR #1427 must remain visible before its issue link has been imported.
    prs.push({ github_pull_request_id: 4690293495, state: "open", merged: false, updated_at: "2026-09-30T12:13:07Z" });
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1);
      let rows: unknown[] = [];
      if (table === "issues") rows = url.searchParams.get("state") === "eq.open" ? issues : closed;
      if (table === "issue_pull_requests") rows = links;
      if (table === "pull_requests") {
        expect(url.searchParams.has("github_pull_request_id")).toBe(false);
        rows = prs;
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      // A server may return fewer rows than requested; this must not end pagination.
      const limit = Math.min(73, Number(url.searchParams.get("limit")));
      return new Response(JSON.stringify(rows.slice(offset, offset + limit)), {
        headers: { "content-range": `${offset}-${offset + limit - 1}/${rows.length}` },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDashboardData("all");

    expect(result.openIssues.data).toHaveLength(1205);
    expect(result.closedIssues.data).toHaveLength(25);
    expect(result.links.data).toHaveLength(241);
    expect(result.openPullRequests.data.length + result.mergedPullRequests.data.length).toBe(242);
    expect(result.openPullRequests.data.some((pr) => pr.github_pull_request_id === 4690293495)).toBe(true);
    expect(result.mergedPullRequests.data.some((pr) => pr.github_pull_request_id === 3240)).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("keeps PRs visible when issue links are empty or unavailable", async () => {
    vi.stubEnv("SUPABASE_URL", "https://database.example");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    const prs = [
      { github_pull_request_id: 4690293495, state: "open", merged: false },
      { github_pull_request_id: 2, state: "closed", merged: true },
      { github_pull_request_id: 3, state: "closed", merged: false },
    ];
    for (const linksFail of [false, true]) {
      vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
        const table = new URL(String(input)).pathname.split("/").at(-1);
        if (table === "issue_pull_requests" && linksFail) return new Response("Links unavailable", { status: 503 });
        const rows = table === "pull_requests" ? prs : [];
        return new Response(JSON.stringify(rows), { headers: { "content-range": `*/${rows.length}` } });
      }));
      const result = await getDashboardData("all");
      expect(result.openPullRequests.data.map((pr) => pr.github_pull_request_id)).toEqual([4690293495, 3]);
      expect(result.mergedPullRequests.data.map((pr) => pr.github_pull_request_id)).toEqual([2]);
      expect(result.links.data).toEqual([]);
      expect(result.errors).toEqual(linksFail ? ["Links unavailable"] : []);
    }
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
    const result = await getDashboardData("all");
    expect(result.openIssues.data).toEqual([]);
    expect(result.errors).toContain("Database unavailable");
  });
});
