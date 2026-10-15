import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mock = vi.hoisted(() => ({ current: vi.fn(), enabled: vi.fn() }));
vi.mock("../../../../lib/scouter/portal", () => ({ currentScouter: mock.current }));
vi.mock("../../../../lib/referrals/server", () => ({
  referralsEnabled: mock.enabled, referralCode: async () => "own-code",
  referralState: async () => ({ referrals: [{ referrer_id: 1, referee_id: 2, referred_at: "2026-10-15T12:00:00Z" }, { referrer_id: 9, referee_id: 3, referred_at: "2026-10-15T12:00:00Z" }], participants: new Set([2]), eligible: new Set([1]) }),
}));
vi.mock("../../../../lib/dashboard/scouters", () => ({ getScouterDirectory: async () => ({ data: [{ account_id: 2, account_login: "InvitedScouter" }, { account_id: 3, account_login: "SomeoneElse" }] }) }));
beforeEach(() => { mock.current.mockResolvedValue({ scouter: { account_id: 1 } }); mock.enabled.mockReturnValue(true); });
describe("scouter referral history", () => {
  it("returns only the authenticated scouter's referrals and public identity, wave and qualification", async () => {
    const response = await GET(); const data = await response.json();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(data.referrals).toEqual([{ accountId: 2, login: "InvitedScouter", referredAt: "2026-10-15T12:00:00Z", wave: 10, qualified: true }]);
    expect(data).toMatchObject({ code: "own-code", count: 1, qualifiedCount: 1, eligible: true });
    expect(JSON.stringify(data)).not.toContain("SomeoneElse");
  });
  it("requires an authenticated scouter", async () => { mock.current.mockResolvedValue(null); expect((await GET()).status).toBe(403); });
  it("respects the feature flag", async () => { mock.enabled.mockReturnValue(false); expect(await (await GET()).json()).toEqual({ enabled: false }); });
});
