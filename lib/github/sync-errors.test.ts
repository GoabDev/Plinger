import { describe, expect, it } from "vitest";
import { describeSyncError } from "./sync-errors";

describe("sync failure descriptions", () => {
  it("identifies missing migrations and database access errors", () => {
    expect(describeSyncError({ code: "PGRST204", message: "Missing recent_last_completed_at" })).toContain("Supabase migrations");
    expect(describeSyncError({ code: "42501" })).toContain("SUPABASE_SECRET_KEY");
    expect(describeSyncError(new Error("Supabase service is not configured"))).toContain("SUPABASE_URL");
    expect(describeSyncError({ message: "Invalid API key" })).toContain("database access was denied");
  });

  it("distinguishes expired tokens from encryption-key problems", () => {
    expect(describeSyncError(new Error("GitHub token validation failed: 401"))).toContain("invalid or expired");
    expect(describeSyncError(new Error("PAT encryption key must be 32 bytes in base64"))).toContain("PLINGER_PAT_ENCRYPTION_KEY");
    expect(describeSyncError(new Error("Unsupported state or unable to authenticate data"))).toContain("original PLINGER_PAT_ENCRYPTION_KEY");
    expect(describeSyncError(new Error("GitHub authored pull request search: 403"))).toContain("rate-limited");
  });

  it("does not echo arbitrary exception or database contents", () => {
    const secret = "sb_secret_not_for_responses";
    expect(describeSyncError(new Error(`Request failed with ${secret}`))).not.toContain(secret);
    expect(describeSyncError({ code: "XX000", message: secret })).toContain("XX000");
    expect(describeSyncError({ code: "XX000", message: secret })).not.toContain(secret);
  });

  it("preserves the reason inside a phase error", () => {
    expect(describeSyncError(new Error("Sync failed", { cause: { code: "PGRST204" } }))).toContain("Supabase migrations");
  });
});
