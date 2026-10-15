import { beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGitHub } from "./actions";
const mock = vi.hoisted(() => ({ signOut: vi.fn(), oauth: vi.fn(), remove: vi.fn(), maintenance: vi.fn(), pass: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "developer-pass" }), delete: mock.remove }), headers: async () => new Headers({ origin: "https://plinger.test" }) }));
vi.mock("../../../lib/maintenance", () => ({ MAINTENANCE_COOKIE: "plinger-maintenance-pass", maintenanceEnabled: mock.maintenance, validMaintenancePass: mock.pass }));
vi.mock("../../../lib/supabase/auth-client", () => ({ createAuthClient: async () => ({ auth: { signOut: mock.signOut, signInWithOAuth: mock.oauth } }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.maintenance.mockReturnValue(true); mock.pass.mockReturnValue(true);
  mock.signOut.mockResolvedValue({ error: null });
  mock.oauth.mockResolvedValue({ data: { url: "https://github.com/login/oauth/authorize" }, error: null });
});
describe("scouter account switching", () => {
  it("replaces only the local session and requests GitHub's account chooser without deleting the maintenance pass", async () => {
    await expect(signInWithGitHub()).rejects.toThrow("redirect:https://github.com/login/oauth/authorize");
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mock.oauth).toHaveBeenCalledWith({ provider: "github", options: { redirectTo: "https://plinger.test/auth/callback?next=/scouter", queryParams: { prompt: "select_account" } } });
    expect(mock.remove).not.toHaveBeenCalled();
  });
  it("blocks OAuth during maintenance without a valid developer pass", async () => {
    mock.pass.mockReturnValue(false);
    await expect(signInWithGitHub()).rejects.toThrow("redirect:/maintenance");
    expect(mock.oauth).not.toHaveBeenCalled();
    expect(mock.signOut).not.toHaveBeenCalled();
  });
  it("does not start a new login if the current session cannot be cleared", async () => {
    mock.signOut.mockResolvedValue({ error: new Error("unavailable") });
    await expect(signInWithGitHub()).rejects.toThrow("redirect:/scouter/login?error=oauth");
    expect(mock.oauth).not.toHaveBeenCalled();
  });
});
