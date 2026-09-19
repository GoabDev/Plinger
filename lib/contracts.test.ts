import { describe, expect, it } from "vitest";
import { responseJson } from "./api/client";
import { adminSignInSchema } from "./auth/contracts";
import { githubSyncRequestSchema, githubSyncResultSchema } from "./github/contracts";
import { bankDetailsSchema, githubPatSchema, proofReviewSchema } from "./scouter/contracts";

describe("shared validation contracts", () => {
  it("normalizes valid admin credentials", () => {
    expect(adminSignInSchema.parse({ email: " admin@example.com ", password: "secret" })).toEqual({
      email: "admin@example.com",
      password: "secret",
    });
  });

  it("rejects malformed admin credentials", () => {
    expect(adminSignInSchema.safeParse({ email: "invalid", password: "" }).success).toBe(false);
  });

  it("accepts supported GitHub PAT prefixes", () => {
    expect(githubPatSchema.safeParse({ kind: "pat", pat: `github_pat_${"a".repeat(24)}` }).success).toBe(true);
    expect(githubPatSchema.safeParse({ kind: "pat", pat: "not-a-token" }).success).toBe(false);
  });

  it("validates and trims bank details", () => {
    expect(bankDetailsSchema.parse({ kind: "bank", bankName: " PalmPay ", accountName: " Ajogu Joseph ", accountNumber: "8146821934" })).toEqual({
      kind: "bank",
      bankName: "PalmPay",
      accountName: "Ajogu Joseph",
      accountNumber: "8146821934",
    });
  });

  it("restricts proof review statuses", () => {
    expect(proofReviewSchema.safeParse({ status: "confirmed" }).success).toBe(true);
    expect(proofReviewSchema.safeParse({ status: "approved" }).success).toBe(false);
  });

  it("validates GitHub sync responses", () => {
    expect(githubSyncRequestSchema.safeParse({ mode: "poll" }).success).toBe(true);
    expect(githubSyncRequestSchema.safeParse({ mode: "partial" }).success).toBe(false);
    expect(githubSyncResultSchema.safeParse({ checked: 2, failed: 0, skipped: 1, mode: "full" }).success).toBe(true);
    expect(githubSyncResultSchema.safeParse({ checked: -1, failed: 0, skipped: 0, mode: "full" }).success).toBe(false);
  });
});

describe("responseJson", () => {
  it("returns a successful JSON body", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    await expect(responseJson<{ ok: boolean }>(response)).resolves.toEqual({ ok: true });
  });

  it("uses an API error message for failed responses", async () => {
    const response = new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    await expect(responseJson(response)).rejects.toThrow("Not authorized");
  });
});
