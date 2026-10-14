import { NextResponse } from "next/server";
import { currentScouter } from "../../../lib/scouter/portal";
import { readReferrals, signupPending } from "../../../lib/referrals/server";

export async function GET() {
  try {
    if (await signupPending()) return NextResponse.json({ error: "Finish referral onboarding first" }, { status: 409 });
    const current = await currentScouter();
    if (!current?.scouter.account_id) return NextResponse.json({ error: "Scouter account required" }, { status: 403 });
    const result = await readReferrals({ id: current.scouter.account_id, login: current.scouter.account_login, user: current.user });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Referrals are unavailable. Please try again later." }, { status: 503 }); }
}
