import { responseJson } from "../api/client";
import type { ReferralsData, ReferralEvidence } from "./contracts";
export const referralQueryKey = ["referrals"] as const;
export async function getReferrals(admin = false) {
  return responseJson<ReferralsData>(await fetch(admin ? "/api/admin/referrals" : "/api/referrals", { cache: "no-store" }));
}
export async function getReferralEvidence(id: string) {
  return responseJson<ReferralEvidence>(await fetch(`/api/admin/referrals?evidence=${encodeURIComponent(id)}`, { cache: "no-store" }));
}
export async function saveReferralData(path: "waves" | "referrals", input: unknown) {
  return responseJson(await fetch(`/api/admin/${path}`, {
    method: path === "waves" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}
