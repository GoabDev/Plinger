import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { syncRecentScouterWorkBatch, syncScouterAssignmentsBatch } from "../../../../lib/github/assignment-sync";
import { selectSupabaseRows } from "../../../../lib/supabase/server";

vi.mock("../../../../lib/github/monitor", () => ({ syncGitHubSubject: vi.fn(), syncRepositoryIssues: vi.fn() }));
vi.mock("../../../../lib/supabase/server", () => ({
  selectSupabaseRows: vi.fn(async () => ({ data: [], count: 0 })),
  updateSupabaseRows: vi.fn(),
}));
vi.mock("../../../../lib/supabase/auth-client", () => ({
  createAuthClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) } })),
}));
vi.mock("../../../../lib/supabase/auth-config", () => ({ isAdmin: vi.fn(() => true) }));
vi.mock("../../../../lib/github/assignment-sync", () => ({
  syncRecentScouterWorkBatch: vi.fn(), syncScouterAssignmentsBatch: vi.fn(),
}));

const completed = { scoutersChecked: 1, pagesChecked: 2, issuesChecked: 1, pullRequestsChecked: 1, linksChecked: 1, completed: 1, failed: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GITHUB_APP_ID", "1");
  vi.stubEnv("GITHUB_PRIVATE_KEY", "test-key");
  vi.stubEnv("PLINGER_SYNC_SECRET", "test-secret");
  vi.mocked(syncRecentScouterWorkBatch).mockResolvedValue(completed);
  vi.mocked(syncScouterAssignmentsBatch).mockResolvedValue(completed);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function scheduledRequest(mode = "poll", scouterLogin?: string) {
  return new Request("https://plinger.example/api/github/sync", {
    method: "POST", headers: { authorization: "Bearer test-secret", "content-type": "application/json" }, body: JSON.stringify({ mode, scouterLogin, month: "all" }),
  });
}

describe("sync failure responses", () => {
  it("defaults routine sync to the current month without running a full history scan", async () => {
    const response = await POST(new Request("https://plinger.example/api/github/sync", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(syncRecentScouterWorkBatch).toHaveBeenCalledWith({ concurrency: 3, month: new Date().toISOString().slice(0, 7) });
    expect(syncScouterAssignmentsBatch).not.toHaveBeenCalled();
    expect(selectSupabaseRows).not.toHaveBeenCalled();
  });

  it("honors an admin's selected historical month and rejects invalid months", async () => {
    const request = (month: string) => new Request("https://plinger.example/api/github/sync", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "full", month }),
    });
    expect((await POST(request("2025-02"))).status).toBe(200);
    expect(syncRecentScouterWorkBatch).toHaveBeenCalledWith({ concurrency: 3, month: "2025-02" });
    expect(syncScouterAssignmentsBatch).not.toHaveBeenCalled();
    vi.clearAllMocks();
    expect((await POST(request("2025-13"))).status).toBe(400);
    expect(syncRecentScouterWorkBatch).not.toHaveBeenCalled();
  });

  it("returns an actionable reason when the batch fails before checking any scouters", async () => {
    vi.mocked(syncRecentScouterWorkBatch).mockRejectedValue({ code: "PGRST204", message: "private database detail" });
    const response = await POST(scheduledRequest());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.assignmentSync.scoutersChecked).toBe(0);
    expect(body.error).toContain("Supabase migrations");
    expect(body.errors).toEqual([body.error]);
    expect(JSON.stringify(body)).not.toContain("private database detail");
  });

  it("preserves the failed account and partial progress for an admin refresh", async () => {
    const error = "@zazorplayz: Saved GitHub token is invalid or expired. Re-save a valid PAT for this Scouter.";
    vi.mocked(syncRecentScouterWorkBatch).mockResolvedValue({ ...completed, failed: 1, errors: [error] });
    const response = await POST(new Request("https://plinger.example/api/github/sync", { method: "POST" }));
    expect(response.status).toBe(207);
    const body = await response.json();
    expect(body.errors).toEqual([error]);
    expect(body.assignmentSync.pullRequestsChecked).toBe(1);
  });

  it("includes full-sync failures and avoids leaking unknown exception details", async () => {
    vi.mocked(syncScouterAssignmentsBatch).mockRejectedValue(new Error("request used sb_secret_private"));
    const response = await POST(scheduledRequest("full"));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.error).toContain("Full work sync");
    expect(JSON.stringify(body)).not.toContain("sb_secret_private");
  });

  it("keeps successful syncs successful", async () => {
    const response = await POST(scheduledRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.failed).toBe(0);
    expect(body.errors).toEqual([]);
    expect(body.error).toBeUndefined();
  });

  it("targets both recent and full imports to the requested Scouter", async () => {
    const response = await POST(scheduledRequest("full", "zazorplayz"));
    expect(response.status).toBe(200);
    expect(vi.mocked(syncRecentScouterWorkBatch)).toHaveBeenCalledWith({ concurrency: 3, login: "zazorplayz" });
    expect(vi.mocked(syncScouterAssignmentsBatch)).toHaveBeenCalledWith({ maxScouters: 1, maxPagesPerScouter: 5, concurrency: 2, login: "zazorplayz" });
    expect((await response.json()).scouterLogin).toBe("zazorplayz");
    expect(selectSupabaseRows).not.toHaveBeenCalled();
  });

  it("rejects malformed target logins before attempting any imports", async () => {
    const response = await POST(scheduledRequest("full", "zazorplayz%"));
    expect(response.status).toBe(400);
    expect(syncRecentScouterWorkBatch).not.toHaveBeenCalled();
  });
});
