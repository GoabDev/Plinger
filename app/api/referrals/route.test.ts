import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mock = vi.hoisted(() => ({ isAdmin: vi.fn(), rpc: vi.fn(), directory: vi.fn() }));
vi.mock("../../../lib/supabase/auth-client", () => ({ createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "verified-admin" } } }) } }) }));
vi.mock("../../../lib/supabase/auth-config", () => ({ isAdmin: mock.isAdmin }));
vi.mock("../../../lib/scouter/portal", () => ({ sameOrigin: (request: Request) => request.headers.get("origin") === "https://plinger.test", serviceClient: () => ({ rpc: mock.rpc }) }));
vi.mock("../../../lib/dashboard/scouters", () => ({ getScouterDirectory: mock.directory }));
vi.mock("../../../lib/referrals/server", () => ({ referralsEnabled: () => true, referralCode: vi.fn(), referralState: vi.fn() }));
const proofId = "00000000-0000-4000-8000-000000000010";
function request(body: object, origin = "https://plinger.test") {
  return new Request("https://plinger.test/api/referrals", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); mock.isAdmin.mockReturnValue(true); mock.rpc.mockResolvedValue({ error: null }); });
describe("admin referral access", () => {
  it("rejects non-admin reads and writes", async () => {
    mock.isAdmin.mockReturnValue(false);
    expect((await GET()).status).toBe(403);
    expect((await POST(request({ action: "tag", proofId }))).status).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin changes and invalid data", async () => {
    expect((await POST(request({ action: "tag", proofId }, "https://other.test"))).status).toBe(403);
    expect((await POST(request({ action: "tag", proofId: "bad" }))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("uses the authenticated admin as the reviewer", async () => {
    expect((await POST(request({ action: "tag", proofId, actor: "forged" }))).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("wave10_tag_proof", { p_id: proofId, p_actor: "verified-admin" });
  });
  it("rejects self attribution before touching the database", async () => {
    expect((await POST(request({ action: "assign", referrer: 1, referee: 1, referredAt: "2026-10-15T00:00:00Z" }))).status).toBe(400);
    expect(mock.directory).not.toHaveBeenCalled();
  });
});
