import { NextResponse } from "next/server";
import { currentScouter } from "../../../../lib/scouter/portal";
import { referralCode, referralState, referralsEnabled } from "../../../../lib/referrals/server";
import { referralsOpen } from "../../../../lib/referrals/rules";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    if (!referralsEnabled()) return NextResponse.json({ enabled: false }, { headers });
    const account = current.scouter.account_id;
    const [code, state] = await Promise.all([referralCode(account), referralState()]);
    const own = state.referrals.filter((r) => Number(r.referrer_id) === account);
    return NextResponse.json({ enabled: true, open: referralsOpen(), path: `/r/${code}`, count: own.length,
      qualifiedCount: own.filter((r) => state.participants.has(Number(r.referee_id))).length,
      eligible: state.eligible.has(account) }, { headers });
  } catch (error) {
    console.error("[referral:self]", error);
    return NextResponse.json({ error: "Referrals are temporarily unavailable" }, { status: 503 });
  }
}
