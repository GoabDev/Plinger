import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

const mocks = vi.hoisted(() => ({ config: vi.fn(() => null) }));
vi.mock("./auth-config", () => ({ getAuthConfig: mocks.config }));
beforeEach(() => vi.clearAllMocks());

describe("homepage OAuth recovery", () => {
  it("forwards the code to the same host's callback before checking auth config", async () => {
    const response = await proxy(new NextRequest("https://preview.plinger.test/?code=test-code&next=https://evil.test&unrelated=discard"));
    const destination = new URL(response.headers.get("location")!);
    expect(destination.origin).toBe("https://preview.plinger.test");
    expect(destination.pathname).toBe("/auth/callback");
    expect(Object.fromEntries(destination.searchParams)).toEqual({ code: "test-code", next: "/scouter", recovery: "site" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.config).not.toHaveBeenCalled();
  });

  it("preserves explicit referral metadata for callback validation", async () => {
    const response = await proxy(new NextRequest("https://plinger.test/?code=test-code&referralIntent=attempt"));
    expect(new URL(response.headers.get("location")!).searchParams.get("referralIntent")).toBe("attempt");
  });

  it.each(["error=access_denied", "error_code=oauth_failed&code=unused"])("sends %s back to login without forwarding provider details", async (query) => {
    const response = await proxy(new NextRequest(`https://plinger.test/?${query}&error_description=private-detail`));
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter/login?error=oauth");
  });

  it("keeps ordinary homepage visits public and avoids an auth request", async () => {
    const response = await proxy(new NextRequest("https://plinger.test/?utm_source=github"));
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.config).not.toHaveBeenCalled();
  });
});
