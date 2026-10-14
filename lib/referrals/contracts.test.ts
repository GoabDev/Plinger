import { describe, expect, it } from "vitest";
import { acceptsReferrals, acceptsEarnings, parseReferralCode, referralReviewInput, type Wave } from "./contracts";
const code = "00000000-0000-4000-8000-000000000060";
const wave: Wave = { id: code, name: "Wave 10", status: "active", starts_at: "2026-11-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z", qualification_deadline: "2026-12-08T00:00:00Z", timezone: "Africa/Lagos" };
describe("referral inputs and wave boundaries", () => {
  it("accepts only canonical links or codes, never another origin or redirect URL", () => {
    expect(parseReferralCode(`https://plinger.vercel.app/r/${code}`, "https://plinger.vercel.app")).toBe(code);
    expect(parseReferralCode(code, "https://plinger.vercel.app")).toBe(code);
    for (const url of [`https://evil.test/r/${code}`, `https://plinger.vercel.app.evil.test/r/${code}`, `https://user:pass@plinger.vercel.app/r/${code}`, `https://plinger.vercel.app/r/${code}?next=https://evil.test`]) expect(parseReferralCode(url, "https://plinger.vercel.app")).toBeNull();
  });
  it("includes the start and excludes the end, while settlement accepts earnings", () => {
    expect(acceptsReferrals(wave, Date.parse(wave.starts_at!))).toBe(true);
    expect(acceptsReferrals(wave, Date.parse(wave.ends_at!))).toBe(false);
    expect(acceptsReferrals({ ...wave, status: "draft" }, Date.parse(wave.starts_at!))).toBe(false);
    expect(acceptsEarnings({ ...wave, status: "settling" }, Date.parse(wave.ends_at!))).toBe(true);
    expect(acceptsEarnings(wave, Date.parse(wave.qualification_deadline!))).toBe(false);
  });
  it("requires completed issue evidence and explicit verification for qualification", () => {
    expect(referralReviewInput.safeParse({ id: code, status: "qualified", reason: "Looks active enough" }).success).toBe(false);
    expect(referralReviewInput.safeParse({ id: code, status: "qualified", reason: "Verified the accepted contribution", issueId: 123, contributionVerified: true }).success).toBe(true);
  });
});
