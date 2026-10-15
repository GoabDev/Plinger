import { splitEarnings } from "../scouter/money";

export const WAVE = 10;
export const WAVE_START = "2026-10-14T23:00:00.000Z";
export const WAVE_END = "2026-10-22T23:00:00.000Z";
export function referralsOpen(now = Date.now()) {
  return now >= Date.parse(WAVE_START) && now < Date.parse(WAVE_END);
}
export type ReferralEarning = {
  wave10?: boolean;
  referralEligible?: boolean;
  bonusPaidStroops?: string;
  bonusPaidKobo?: string;
  amount_stroops: string | number | null;
  payout_status: string;
  payout_scouter_share_stroops: string | number | null;
  payout_amount_kobo: string | number | null;
};
export function earningBalance(proof: ReferralEarning) {
  const base = splitEarnings(proof.amount_stroops ?? "0");
  const bonus = proof.wave10 && proof.referralEligible
    ? base.gross * 70n / 100n - base.scouter : 0n;
  const paidBonus = BigInt(proof.bonusPaidStroops ?? "0");
  const scouter = base.scouter + (bonus > paidBonus ? bonus : paidBonus);
  const paid = (proof.payout_status === "paid" ? BigInt(proof.payout_scouter_share_stroops ?? base.scouter) : 0n) + paidBonus;
  return { gross: base.gross, scouter, admin: base.gross - scouter, bonus,
    paid, due: scouter > paid ? scouter - paid : 0n,
    paidKobo: (proof.payout_status === "paid" ? BigInt(proof.payout_amount_kobo ?? "0") : 0n) + BigInt(proof.bonusPaidKobo ?? "0") };
}
