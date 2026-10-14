import { z } from "zod";

export type Wave = {
  id: string; name: string; status: "draft" | "active" | "settling" | "closed";
  starts_at: string | null; ends_at: string | null; qualification_deadline: string | null; timezone: string;
};
export type Referral = {
  id: string; referrer_account_id: number; referred_account_id: number; wave_id: string;
  status: "pending" | "qualified" | "rejected" | "revoked" | "expired";
  joined_at: string; reviewed_at: string | null; reason: string | null;
  referrer_login: string; referred_login: string;
};
export type ReferralsData = { waves: Wave[]; referrals: Referral[]; link?: string; activeWave: Wave | null; accountId?: number };
export type ReferralEvidence = {
  issues: Array<{ github_issue_id: number; title: string; url: string; closed_at: string }>;
  mergedPullRequests: Array<{ title: string; url: string; merged_at: string }>;
  confirmedEarnings: number; paidEarnings: number;
};
export const waveInput = z.object({
  operation: z.literal("extend").optional(),
  id: z.uuid().optional(), name: z.string().trim().min(1).max(80),
  status: z.enum(["draft", "active", "settling", "closed"]).default("draft"),
  starts_at: z.iso.datetime({ offset: true }).nullable().optional(),
  ends_at: z.iso.datetime({ offset: true }).nullable().optional(),
  qualification_deadline: z.iso.datetime({ offset: true }).nullable().optional(),
  timezone: z.string().min(1).max(100).default("Africa/Lagos"),
});
export const referralReviewInput = z.object({
  id: z.uuid(), status: z.enum(["qualified", "rejected", "revoked"]),
  reason: z.string().trim().min(10).max(2000),
  issueId: z.number().int().positive().safe().optional(),
  contributionVerified: z.boolean().default(false),
}).refine((v) => v.status !== "qualified" || (v.issueId && v.contributionVerified), "Select completed work and verify the contribution");

export function acceptsReferrals(wave: Wave, now = Date.now()) {
  return wave.status === "active" && Boolean(wave.starts_at && wave.ends_at)
    && now >= Date.parse(wave.starts_at!) && now < Date.parse(wave.ends_at!);
}
export function acceptsEarnings(wave: Wave, now = Date.now()) {
  return ["active", "settling"].includes(wave.status) && Boolean(wave.starts_at && wave.qualification_deadline)
    && now >= Date.parse(wave.starts_at!) && now < Date.parse(wave.qualification_deadline!);
}
export function parseReferralCode(value: string, siteOrigin: string): string | null {
  const input = value.trim();
  if (z.uuid().safeParse(input).success) return input.toLowerCase();
  try {
    const url = new URL(input);
    if (url.origin !== new URL(siteOrigin).origin || url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/r\/([^/]+)\/?$/);
    return match && z.uuid().safeParse(match[1]).success ? match[1].toLowerCase() : null;
  } catch { return null; }
}
