import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), origin: vi.fn(), rpc: vi.fn(), evidence: vi.fn(), read: vi.fn() }));
vi.mock("../../../../lib/referrals/server", () => ({ requireAdmin: mocks.admin, referralEvidence: mocks.evidence, readReferrals: mocks.read, databaseMessage: () => "Conflict" }));
vi.mock("../../../../lib/scouter/portal", () => ({ sameOrigin: mocks.origin, serviceClient: () => ({ rpc: mocks.rpc }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.admin.mockResolvedValue({ id: "admin" }); mocks.origin.mockReturnValue(true); mocks.rpc.mockResolvedValue({ error: null }); mocks.evidence.mockResolvedValue({ issues: [] }); });
const id = "00000000-0000-4000-8000-000000000020";
function request(body: unknown) { return new Request("https://plinger.test/api/admin/referrals", { method: "PATCH", body: JSON.stringify(body) }); }
describe("admin referral authorization", () => {
  it("denies an ordinary user both reads and writes", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await GET(new Request("https://plinger.test/api/admin/referrals"))).status).toBe(403);
    expect((await PATCH(request({ id }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests before any mutation", async () => {
    mocks.origin.mockReturnValue(false);
    expect((await PATCH(request({ id }))).status).toBe(403); expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires contribution verification and uses server-fetched evidence", async () => {
    expect((await PATCH(request({ id, status: "qualified", reason: "An active contributor" }))).status).toBe(400);
    expect((await PATCH(request({ id, status: "qualified", reason: "Verified accepted work", issueId: 123, contributionVerified: true, evidence: { fake: true } }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("review_referral", expect.objectContaining({ p_actor: "admin", p_evidence: { issues: [], contributionVerified: true } }));
  });
});
