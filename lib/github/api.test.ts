import { afterEach, describe, expect, it, vi } from "vitest";
import { getGitHubTokenOwner, GitHubTokenValidationError } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitHub token validation", () => {
  it("returns the authenticated GitHub account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42, login: "scouter" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    await expect(getGitHubTokenOwner("github_pat_test")).resolves.toEqual({ id: 42, login: "scouter" });
  });

  it("rejects an invalid token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad credentials", { status: 401 })));

    await expect(getGitHubTokenOwner("invalid")).rejects.toBeInstanceOf(GitHubTokenValidationError);
  });
});
