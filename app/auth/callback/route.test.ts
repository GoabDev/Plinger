import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const intent = "00000000-0000-4000-8000-000000000001";
const callback = `https://plinger.test/auth/callback?code=oauth&next=/scouter&referralIntent=${intent}`;
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), user: vi.fn(), complete: vi.fn(), remove: vi.fn(), get: vi.fn(), set: vi.fn() }));
vi.mock("../../../lib/supabase/auth-client", () => ({ createAuthClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchange, getUser: mocks.user } }) }));
vi.mock("../../../lib/referrals/server", () => ({ completeSignup: mocks.complete, REFERRAL_COOKIE: "plinger-referral-intent", referralAttemptCookie: (id: string) => `plinger-referral-intent-${id}`, canonicalOrigin: () => "https://plinger.test" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get, delete: mocks.remove, set: mocks.set }) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.exchange.mockResolvedValue({ error: null });
  mocks.user.mockResolvedValue({ data: { user: { id: "verified-user" } } });
  mocks.get.mockReturnValue({ value: intent }); mocks.complete.mockResolvedValue("complete");
});
describe("referral OAuth recovery", () => {
  it("uses the verified user and clears the intent only after successful attribution", async () => {
    const response = await GET(new Request(callback));
    expect(mocks.complete).toHaveBeenCalledWith({ id: "verified-user" }, intent);
    expect(mocks.remove).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter");
  });
  it.each(["expired", "wave_changed", "existing"])("preserves a %s intent for explicit resolution", async (result) => {
    mocks.complete.mockResolvedValue(result);
    const response = await GET(new Request(callback));
    expect(response.headers.get("location")).toContain(`/scouter/onboarding?error=${result}`);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("recovers a storage failure without losing the OAuth session or requested referral", async () => {
    mocks.complete.mockRejectedValue(new Error("database down"));
    const response = await GET(new Request(callback));
    expect(response.headers.get("location")).toContain("/scouter/onboarding?error=unavailable");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("does not attribute a failed OAuth exchange or allow an external redirect", async () => {
    mocks.exchange.mockResolvedValue({ error: new Error("failed") });
    const response = await GET(new Request("https://plinger.test/auth/callback?code=bad&next=https://evil.test"));
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter/login?error=oauth");
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("uses this attempt's cookie even if another tab changed the pending referral", async () => {
    mocks.get.mockImplementation((name: string) => ({ value: name.endsWith(intent) ? intent : "another-intent" }));
    await GET(new Request(callback));
    expect(mocks.complete).toHaveBeenCalledWith({ id: "verified-user" }, intent);
  });
  it("does not attribute an intent without its browser-bound attempt cookie", async () => {
    mocks.get.mockReturnValue(undefined);
    const response = await GET(new Request(callback));
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("onboarding?error=invalid");
    expect(mocks.set).toHaveBeenCalledWith("plinger-referral-intent", "invalid", expect.any(Object));
  });
  it("does not attach another tab's pending referral to an ordinary sign-in", async () => {
    await GET(new Request("https://plinger.test/auth/callback?code=oauth&next=/scouter"));
    expect(mocks.complete).toHaveBeenCalledWith({ id: "verified-user" }, null);
  });
  it.each(["&next=/scouter&recovery=site", ""])("completes an ordinary sign-in after a fallback (%s)", async (query) => {
    mocks.get.mockReturnValue(undefined);
    const response = await GET(new Request(`https://plinger.test/auth/callback?code=oauth${query}`));
    expect(mocks.exchange).toHaveBeenCalledWith("oauth");
    expect(mocks.complete).toHaveBeenCalledWith({ id: "verified-user" }, null);
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter");
  });
  it.each(["&next=/scouter&recovery=site", ""])("preserves a pending referral for explicit confirmation after a fallback (%s)", async (query) => {
    const response = await GET(new Request(`https://plinger.test/auth/callback?code=oauth${query}`));
    expect(mocks.exchange).toHaveBeenCalledWith("oauth");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter/onboarding?error=redirect");
  });
  it("still validates an explicit referral when the homepage forwards it", async () => {
    await GET(new Request(`${callback}&recovery=site`));
    expect(mocks.complete).toHaveBeenCalledWith({ id: "verified-user" }, intent);
  });
  it("returns failed fallback exchanges to login without completing signup", async () => {
    mocks.exchange.mockResolvedValue({ error: new Error("missing PKCE verifier") });
    const response = await GET(new Request("https://plinger.test/auth/callback?code=oauth&next=/scouter&recovery=site"));
    expect(response.headers.get("location")).toBe("https://plinger.test/scouter/login?error=oauth");
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
