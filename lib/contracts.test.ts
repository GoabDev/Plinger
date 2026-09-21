import { describe, expect, it } from "vitest";
import { responseJson } from "./api/client";
import { adminSignInSchema } from "./auth/contracts";
import { githubSyncRequestSchema, githubSyncResultSchema } from "./github/contracts";
import { bankDetailsSchema, earningsActionSchema, githubPatSchema, proofReviewSchema } from "./scouter/contracts";
import { calculateNairaKobo, formatNaira, formatNairaKobo, formatNairaRate, formatUsd, splitEarnings } from "./scouter/money";

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

  it("restricts earnings review and payout actions", () => {
    expect(earningsActionSchema.safeParse({ action: "review", status: "confirmed" }).success).toBe(true);
    expect(earningsActionSchema.safeParse({ action: "payout", status: "paid", rateMicros: "1330390000" }).success).toBe(true);
    expect(earningsActionSchema.safeParse({ action: "payout", status: "paid" }).success).toBe(false);
    expect(earningsActionSchema.safeParse({ action: "payout", status: "confirmed" }).success).toBe(false);
  });

  it("calculates the 60/40 split and naira conversion without floating point", () => {
    const split = splitEarnings("150000000");
    expect(formatUsd(split.gross)).toBe("$15.00");
    expect(formatUsd(split.scouter)).toBe("$9.00");
    expect(formatUsd(split.admin)).toBe("$6.00");
    expect(formatNaira(split.scouter, "1330390000")).toBe("\u20a611,973.51");
    expect(calculateNairaKobo(split.scouter, "1330390000")).toBe(BigInt(1_197_351));
    expect(formatNairaKobo("1197351")).toBe("\u20a611,973.51");
    expect(formatNairaRate("1330390000")).toBe("\u20a61,330.39/$");
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
