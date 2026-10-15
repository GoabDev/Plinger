import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { captureReferral, parseReferralCookie, referralCookie } from "./server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), lookup: vi.fn(), account: vi.fn() }));
vi.mock("../scouter/portal", () => ({ githubAccountId: mocks.account, serviceClient: () => ({ from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }), upsert: mocks.upsert,
}) }) }));
const code = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  vi.stubEnv("PLINGER_WAVE10_REFERRALS", "true"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  vi.clearAllMocks(); mocks.account.mockReturnValue(2);
  mocks.lookup.mockResolvedValue({ data: { account_id: 1 }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
const user = (created: string) => ({ id: "user", created_at: created }) as User;
describe("referral signup capture", () => {
  it("rejects tampered attribution cookies", () => {
    const cookie = referralCookie(code);
    expect(parseReferralCookie(cookie)?.code).toBe(code);
    expect(parseReferralCookie(cookie.replace(code, code.replace(/1$/, "2")))).toBeNull();
    expect(parseReferralCookie("bad")).toBeNull();
  });
  it("does not attribute an existing account", async () => {
    await captureReferral(user("2026-10-14T12:00:00Z"), referralCookie(code));
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("records a new GitHub user, preserving the first attribution", async () => {
    const cookie = referralCookie(code);
    vi.setSystemTime(new Date("2026-10-15T12:01:00Z"));
    await captureReferral(user("2026-10-15T12:00:30Z"), cookie);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ referrer_id: 1, referee_id: 2, source: "link" }), { onConflict: "referee_id", ignoreDuplicates: true });
  });
  it("rejects self-referrals and signups after closing", async () => {
    const cookie = referralCookie(code);
    mocks.account.mockReturnValue(1);
    await captureReferral(user("2026-10-15T12:00:00Z"), cookie);
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.account.mockReturnValue(2);
    vi.setSystemTime(new Date("2026-10-22T23:00:00Z"));
    await captureReferral(user("2026-10-22T23:00:00Z"), cookie);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
