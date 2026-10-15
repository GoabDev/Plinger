import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { signIn, signOut } from "./actions";
const mock = vi.hoisted(() => ({ signIn: vi.fn(), signOut: vi.fn(), set: vi.fn(), remove: vi.fn(), isAdmin: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mock.set, delete: mock.remove }) }));
vi.mock("../../lib/supabase/auth-client", () => ({ createAuthClient: async () => ({ auth: { signInWithPassword: mock.signIn, signOut: mock.signOut } }) }));
vi.mock("../../lib/supabase/auth-config", () => ({ isAdmin: mock.isAdmin }));
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("PLINGER_MAINTENANCE", "true"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-key"); vi.stubEnv("PLINGER_ADMIN_EMAIL", "admin@example.test");
  mock.signIn.mockResolvedValue({ data: { user: { id: "admin" } }, error: null }); mock.isAdmin.mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());
function form() { const data = new FormData(); data.set("email", "admin@example.test"); data.set("password", "password"); return data; }
const state = { error: null, fieldErrors: {} };
describe("maintenance admin login", () => {
  it("only issues the pass after a successful admin password login", async () => {
    await expect(signIn(state, form())).rejects.toThrow("redirect:/maintenance/access");
    expect(mock.set).toHaveBeenCalledWith("plinger-maintenance-pass", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 7200 }));
  });
  it("does not issue a pass to non-admins or failed logins", async () => {
    mock.isAdmin.mockReturnValue(false);
    expect((await signIn(state, form())).error).toBe("Invalid credentials.");
    expect(mock.set).not.toHaveBeenCalled();
    mock.signIn.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    expect((await signIn(state, form())).error).toBe("Invalid credentials.");
    expect(mock.set).not.toHaveBeenCalled();
  });
  it("keeps normal login unchanged when maintenance is off", async () => {
    vi.stubEnv("PLINGER_MAINTENANCE", "false");
    await expect(signIn(state, form())).rejects.toThrow("redirect:/dashboard");
    expect(mock.set).not.toHaveBeenCalled();
  });
  it("clears the developer pass on sign out", async () => {
    await expect(signOut()).rejects.toThrow("redirect:/login");
    expect(mock.remove).toHaveBeenCalledWith("plinger-maintenance-pass");
  });
});
