import { describe, expect, it } from "vitest";
import { earningBalance, referralsOpen, WAVE_END, WAVE_START } from "./rules";

const proof = { amount_stroops: "1000000000", payout_status: "unpaid", payout_scouter_share_stroops: null, payout_amount_kobo: null };
describe("Wave 10 referral earnings", () => {
  it("uses Lagos boundaries with an exclusive closing date", () => {
    expect(referralsOpen(Date.parse(WAVE_START) - 1)).toBe(false);
    expect(referralsOpen(Date.parse(WAVE_START))).toBe(true);
    expect(referralsOpen(Date.parse(WAVE_END) - 1)).toBe(true);
    expect(referralsOpen(Date.parse(WAVE_END))).toBe(false);
  });
  it("only increases explicitly assigned Wave 10 earnings", () => {
    expect(earningBalance({ ...proof, referralEligible: true }).scouter).toBe(600000000n);
    expect(earningBalance({ ...proof, wave10: true }).scouter).toBe(600000000n);
    expect(earningBalance({ ...proof, wave10: true, referralEligible: true }).scouter).toBe(700000000n);
  });
  it("keeps a paid 60% snapshot and owes only the late 10%", () => {
    const balance = earningBalance({ ...proof, wave10: true, referralEligible: true, payout_status: "paid", payout_scouter_share_stroops: "600000000", payout_amount_kobo: "9000000" });
    expect(balance.paid).toBe(600000000n);
    expect(balance.due).toBe(100000000n);
    expect(balance.paidKobo).toBe(9000000n);
  });
  it("records bonus payments without paying twice", () => {
    const balance = earningBalance({ ...proof, wave10: true, referralEligible: true, payout_status: "paid", payout_scouter_share_stroops: "600000000", payout_amount_kobo: "9000000", bonusPaidStroops: "100000000", bonusPaidKobo: "1500000" });
    expect(balance.paid).toBe(700000000n);
    expect(balance.due).toBe(0n);
    expect(balance.admin).toBe(300000000n);
    expect(balance.paidKobo).toBe(10500000n);
  });
  it("uses integer rounding and preserves gross = scouter + Plinger", () => {
    const result = earningBalance({ ...proof, amount_stroops: "19", wave10: true, referralEligible: true });
    expect(result.scouter).toBe(13n);
    expect(result.scouter + result.admin).toBe(19n);
  });
});
