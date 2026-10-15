import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMaintenancePass, validMaintenancePass, MAINTENANCE_PASS_SECONDS, maintenanceProtectedPath, maintenanceEnabled } from "./maintenance";

beforeEach(() => { vi.stubEnv("SUPABASE_SECRET_KEY", "test-key"); vi.stubEnv("PLINGER_ADMIN_EMAIL", "admin@example.test"); });
afterEach(() => vi.unstubAllEnvs());
describe("maintenance passes", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  it("grants a signed two-hour pass and rejects expiry", () => {
    const pass = createMaintenancePass(now);
    expect(validMaintenancePass(pass, now)).toBe(true);
    expect(validMaintenancePass(pass, now + MAINTENANCE_PASS_SECONDS * 1000 - 1)).toBe(true);
    expect(validMaintenancePass(pass, now + MAINTENANCE_PASS_SECONDS * 1000)).toBe(false);
  });
  it("rejects tampering and malformed cookies", () => {
    const pass = createMaintenancePass(now);
    const [expires, mac] = pass.split(".");
    expect(validMaintenancePass(`${Number(expires)-1}.${mac}`, now)).toBe(false);
    expect(validMaintenancePass(`${expires}.${"a".repeat(64)}`, now)).toBe(false);
    for (const value of [undefined, "true", `${pass}.extra`, "developer"]) expect(validMaintenancePass(value, now)).toBe(false);
  });
  it("revokes passes when the signing key or configured admin changes", () => {
    const pass = createMaintenancePass(now);
    vi.stubEnv("PLINGER_ADMIN_EMAIL", "different@example.test");
    expect(validMaintenancePass(pass, now)).toBe(false);
    vi.stubEnv("SUPABASE_SECRET_KEY", "different-key");
    expect(validMaintenancePass(pass, now)).toBe(false);
  });
  it("is disabled by default and only enabled by true", () => {
    vi.stubEnv("PLINGER_MAINTENANCE", "false"); expect(maintenanceEnabled()).toBe(false);
    vi.stubEnv("PLINGER_MAINTENANCE", "true"); expect(maintenanceEnabled()).toBe(true);
  });
  it("protects workspaces and APIs while preserving public pages and integrations", () => {
    for (const path of ["/scouter", "/scouter/login", "/dashboard", "/api/me/scouter", "/api/earnings", "/api/referrals", "/r/code"]) expect(maintenanceProtectedPath(path)).toBe(true);
    for (const path of ["/", "/docs", "/login", "/maintenance", "/auth/callback", "/api/maintenance", "/api/github/webhook", "/api/github/sync"]) expect(maintenanceProtectedPath(path)).toBe(false);
    expect(maintenanceProtectedPath("/api/github/webhook/anything")).toBe(true);
  });
});
