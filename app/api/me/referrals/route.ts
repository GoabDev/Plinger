import { NextResponse } from "next/server";
import { currentScouter } from "../../../../lib/scouter/portal";
import { referralCode, referralState, referralsEnabled } from "../../../../lib/referrals/server";
import { referralsOpen } from "../../../../lib/referrals/rules";
import { getScouterDirectory } from "../../../../lib/dashboard/scouters";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    if (!referralsEnabled()) return NextResponse.json({ enabled: false }, { headers });
    const account = current.scouter.account_id;
    const [code, state, directory] = await Promise.all([referralCode(account), referralState(), getScouterDirectory()]);
    const own = state.referrals.filter((r) => Number(r.referrer_id) === account);
    const logins = new Map(directory.data.map((person) => [person.account_id, person.account_login]));
    return NextResponse.json({ enabled: true, open: referralsOpen(), code, wave: 10, path: `/r/${code}`, count: own.length,
      referrals: own.map((person) => ({ accountId: Number(person.referee_id), login: logins.get(Number(person.referee_id)) ?? null,
        referredAt: person.referred_at, wave: 10, qualified: state.participants.has(Number(person.referee_id)) })),
      qualifiedCount: own.filter((r) => state.participants.has(Number(r.referee_id))).length,
      eligible: state.eligible.has(account) }, { headers });
  } catch (error) {
    console.error("[referral:self]", error);
    return NextResponse.json({ error: "Referrals are temporarily unavailable" }, { status: 503 });
  }
}
