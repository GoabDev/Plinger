import { afterEach, describe, expect, it, vi } from "vitest";
import { syncGitHub } from "./client";

afterEach(() => vi.unstubAllGlobals());
describe("manual scouter sync request", () => {
  it("targets the selected scouter across all history", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ checked: 0, failed: 0, skipped: 0, mode: "full" }));
    vi.stubGlobal("fetch", fetcher);
    await syncGitHub("all", "dorky-1235");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ mode: "full", month: "all", scouterLogin: "dorky-1235" });
  });
  it("preserves partial failures returned with HTTP 207", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ checked: 0, failed: 1, skipped: 0, mode: "full", errors: ["Saved GitHub token is invalid or expired."] }, { status: 207 })));
    expect((await syncGitHub("all", "dorky-1235")).errors).toEqual(["Saved GitHub token is invalid or expired."]);
  });
});
