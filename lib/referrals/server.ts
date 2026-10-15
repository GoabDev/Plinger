import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { githubAccountId, serviceClient } from "../scouter/portal";
import { referralsOpen } from "./rules";

export const REFERRAL_COOKIE = "plinger-wave10-referral";
export const referralsEnabled = () => process.env.PLINGER_REFERRALS === "true";
export async function referralCode(accountId: number) {
  const client = serviceClient();
  const { error } = await client.from("wave10_referral_codes").upsert({ account_id: accountId }, { onConflict: "account_id", ignoreDuplicates: true });
  if (error) throw error;
  const result = await client.from("wave10_referral_codes").select("code").eq("account_id", accountId).single();
  if (result.error) throw result.error;
  return result.data.code as string;
}
function signature(payload: string) {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Referral signing is not configured");
  return createHmac("sha256", key).update(payload).digest("hex");
}
export function referralCookie(code: string) {
  const payload = `${code}.${Date.now()}`;
  return `${payload}.${signature(payload)}`;
}
export function parseReferralCookie(value: string) {
  const [code, timestamp, mac] = value.split(".");
  if (!/^[\da-f-]{36}$/.test(code ?? "") || !/^\d{13}$/.test(timestamp ?? "") || !/^[\da-f]{64}$/.test(mac ?? "")) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(signature(`${code}.${timestamp}`)))) return null;
  const arrived = Number(timestamp);
  return referralsOpen(arrived) && arrived <= Date.now() ? { code, arrived } : null;
}
export async function captureReferral(user: User, cookie: string) {
  if (!referralsEnabled() || !referralsOpen()) return;
  const intent = parseReferralCookie(cookie);
  const accountId = githubAccountId(user);
  // Auth creation is authoritative; installing the GitHub App alone isn't a signup.
  if (!intent || !accountId || Date.parse(user.created_at) < intent.arrived) return;
  const client = serviceClient();
  const code = await client.from("wave10_referral_codes").select("account_id").eq("code", intent.code).maybeSingle();
  if (code.error) throw code.error;
  if (!code.data || Number(code.data.account_id) === accountId) return;
  const { error } = await client.from("wave10_referrals").upsert({
    referee_id: accountId, referrer_id: code.data.account_id, source: "link",
    referred_at: user.created_at, recorded_by: user.id,
  }, { onConflict: "referee_id", ignoreDuplicates: true });
  if (error) throw error;
}

async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await page(from, from + 499);
    if (result.error) throw result.error;
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return rows;
  }
}
export async function referralState() {
  const client = serviceClient();
  const [referrals, tags, payments, proofs] = await Promise.all([
    allRows((from, to) => client.from("wave10_referrals").select("*").order("referee_id").range(from, to)),
    allRows((from, to) => client.from("wave10_proofs").select("proof_id").order("proof_id").range(from, to)),
    allRows((from, to) => client.from("wave10_bonus_payments").select("*").order("proof_id").range(from, to)),
    allRows((from, to) => client.from("scouter_withdrawal_proofs").select("id,account_id,status,amount_stroops,chain_verified_at").eq("status", "confirmed").order("id").range(from, to)),
  ]);
  const waveIds = new Set(tags.map((tag) => tag.proof_id));
  const participants = new Set(proofs.filter((p) => waveIds.has(p.id) && p.chain_verified_at && BigInt(p.amount_stroops ?? 0) > 0n).map((p) => Number(p.account_id)));
  const eligible = new Set(referrals.filter((r) => participants.has(Number(r.referee_id))).map((r) => Number(r.referrer_id)));
  return { referrals, waveIds, eligible, participants, payments };
}
export async function withReferralEarnings<T extends { id: string; account_id: number }>(proofs: T[]) {
  if (!referralsEnabled()) return proofs;
  const state = await referralState();
  return proofs.map((proof) => {
    const payment = state.payments.find((p) => p.proof_id === proof.id);
    return { ...proof, wave10: state.waveIds.has(proof.id), referralEligible: state.eligible.has(Number(proof.account_id)),
      bonusPaidStroops: String(payment?.amount_stroops ?? 0), bonusPaidKobo: String(payment?.amount_kobo ?? 0) };
  });
}
