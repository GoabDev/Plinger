import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";
import { createMaintenancePass } from "./lib/maintenance";

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: async () => ({ data: {} }) } }) }));
vi.mock("./lib/supabase/auth-config", () => ({ getAuthConfig: () => ({ url: "https://example.test", publishableKey: "test" }) }));
beforeEach(() => {
  vi.stubEnv("PLINGER_MAINTENANCE", "true"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-key"); vi.stubEnv("PLINGER_ADMIN_EMAIL", "admin@example.test");
});
afterEach(() => vi.unstubAllEnvs());
function request(path: string, cookie = "") { return new NextRequest(`https://plinger.test${path}`, { headers: { cookie } }); }
describe("maintenance proxy", () => {
  it("blocks new and existing ordinary sessions", async () => {
    for (const cookie of ["", "sb-session=existing-session", "plinger-maintenance-pass=true"]) {
      const response = await proxy(request("/scouter", cookie));
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("https://plinger.test/maintenance");
    }
  });
  it("returns noncacheable 503 responses for private APIs", async () => {
    const response = await proxy(request("/api/me/scouter"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).maintenance).toBe(true);
  });
  it("allows signed developer passes, without granting app permissions", async () => {
    const response = await proxy(request("/scouter", `plinger-maintenance-pass=${createMaintenancePass()}`));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
  it("keeps callbacks, webhooks and background sync available", async () => {
    for (const path of ["/auth/callback", "/api/github/webhook", "/api/github/sync", "/api/maintenance"]) {
      expect((await proxy(request(path))).headers.get("x-middleware-next")).toBe("1");
    }
  });
  it("restores normal access when the flag is disabled", async () => {
    vi.stubEnv("PLINGER_MAINTENANCE", "false");
    expect((await proxy(request("/api/me/scouter"))).headers.get("x-middleware-next")).toBe("1");
    expect((await proxy(request("/scouter"))).headers.get("x-middleware-next")).toBe("1");
  });
});
