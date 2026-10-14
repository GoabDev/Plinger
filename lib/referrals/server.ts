import "server-only";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createAuthClient } from "../supabase/auth-client";
import { isAdmin } from "../supabase/auth-config";
import { githubAccountId, serviceClient } from "../scouter/portal";
import { acceptsReferrals, type Wave, type Referral, type ReferralsData, type ReferralEvidence } from "./contracts";
import { readAll } from "../supabase/read-all";

export const REFERRAL_COOKIE = "plinger-referral-intent";
export const referralAttemptCookie = (intent: string) => `${REFERRAL_COOKIE}-${intent}`;
export function canonicalOrigin() {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").origin;
}
export async function requireAdmin() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  return isAdmin(data.user) ? data.user : null;
}
export async function readWaves(): Promise<Wave[]> {
  return readAll<Wave>("waves", { select: "*", order: "created_at.desc,id.asc" });
}
export async function referralPreview(code: string) {
  const client = serviceClient();
  const [{ data, error }, waves] = await Promise.all([
    client.from("referral_codes").select("account_id,code").eq("code", code).eq("enabled", true).maybeSingle(), readWaves(),
  ]);
  if (error) throw error;
  const wave = waves.find((w) => acceptsReferrals(w));
  if (!data || !wave) return null;
  const member = await client.from("scouter_members").select("account_login").eq("account_id", data.account_id).single();
  if (member.error) throw member.error;
  return { code: data.code as string, login: member.data.account_login as string, wave };
}
export async function completeSignup(user: User, intent: string | null, retry = false) {
  const accountId = githubAccountId(user);
  if (!accountId) throw new Error("GitHub account required");
  const identity = user.identities?.find((i) => i.provider === "github");
  const login = String(identity?.identity_data?.user_name || identity?.identity_data?.preferred_username || accountId);
  const { data, error } = await serviceClient().rpc("complete_referral_signup", {
    p_account: accountId, p_login: login, p_user: user.id, p_intent: intent, p_created: user.created_at, p_retry: retry,
  });
  if (error) throw error;
  return data as string;
}
export async function signupPending() { return Boolean((await cookies()).get(REFERRAL_COOKIE)?.value); }

export async function readReferrals(account?: { id: number; login: string; user: User }): Promise<ReferralsData> {
  const client = serviceClient();
  let link: string | undefined;
  if (account) {
    const code = await client.from("referral_codes").select("code").eq("account_id", account.id).single();
    if (code.error) throw code.error;
    link = `${canonicalOrigin()}/r/${code.data.code}`;
  }
  const filter: Record<string, string> = { select: "id,referrer_account_id,referred_account_id,wave_id,status,joined_at,reviewed_at,reason", order: "joined_at.desc,id.asc" };
  if (account) filter.referrer_account_id = `eq.${account.id}`;
  const [waves, result] = await Promise.all([readWaves(), readAll<Referral>("referrals", filter)]);
  const ids = [...new Set(result.flatMap((r) => [r.referrer_account_id, r.referred_account_id]))];
  const names = new Map<number, string>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const members = await readAll<{ account_id: number; account_login: string }>("scouter_members", { select: "account_id,account_login", account_id: `in.(${ids.slice(offset, offset + 100).join(",")})`, order: "account_id.asc" });
    for (const member of members) names.set(member.account_id, member.account_login);
  }
  const referrals = result.map((r) => ({ ...r, reason: account ? null : r.reason,
    referrer_login: names.get(r.referrer_account_id) ?? String(r.referrer_account_id),
    referred_login: names.get(r.referred_account_id) ?? String(r.referred_account_id),
  })) as Referral[];
  return { waves, referrals, link, activeWave: waves.find((w) => acceptsReferrals(w)) ?? null, accountId: account?.id };
}
export async function referralEvidence(id: string): Promise<ReferralEvidence> {
  const client = serviceClient();
  const { data: referral, error } = await client.from("referrals").select("*").eq("id", id).single();
  if (error) throw error;
  const wave = (await readWaves()).find((w) => w.id === referral.wave_id)!;
  const member = await client.from("scouter_members").select("account_login").eq("account_id", referral.referred_account_id).single();
  if (member.error) throw member.error;
  const assignments = await client.from("issue_assignments").select("issue_id").eq("assignee_account_id", referral.referred_account_id).limit(1000);
  if (assignments.error) throw assignments.error;
  const ids = assignments.data.map((a) => a.issue_id);
  const from = new Date(Math.max(Date.parse(wave.starts_at!), Date.parse(referral.joined_at))).toISOString();
  const [issues, prs, earnings] = await Promise.all([
    ids.length ? client.from("issues").select("github_issue_id,title,url,closed_at").in("id", ids).eq("state", "closed").gte("closed_at", from).lt("closed_at", wave.ends_at!).limit(100) : { data: [], error: null },
    client.from("pull_requests").select("title,url,merged_at").ilike("author_login", member.data.account_login).eq("merged", true).gte("merged_at", from).lt("merged_at", wave.ends_at!).limit(100),
    client.from("scouter_earning_balances").select("paid_total_stroops").eq("account_id", referral.referred_account_id).eq("wave_id", wave.id).eq("status", "confirmed"),
  ]);
  for (const result of [issues, prs, earnings]) if (result.error) throw result.error;
  return { issues: issues.data!, mergedPullRequests: prs.data!, confirmedEarnings: earnings.data!.length,
    paidEarnings: earnings.data!.filter((c) => BigInt(c.paid_total_stroops) > 0n).length };
}
export function databaseMessage(error: unknown) {
  const value = error as { code?: string; message?: string };
  return value?.code === "P0001" ? value.message! : value?.code === "23505" ? "That record already exists or another wave is active." : "The request could not be saved. Please refresh and try again.";
}
