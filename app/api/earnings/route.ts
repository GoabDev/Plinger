import { NextResponse } from "next/server";
import { readAllEarnings } from "../../../lib/scouter/earnings";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { isAdmin } from "../../../lib/supabase/auth-config";
import { getUsdNgnRate } from "../../../lib/scouter/exchange-rate";
import { readWaves } from "../../../lib/referrals/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!isAdmin(data.user)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const [claims, exchangeRate, waves] = await Promise.all([readAllEarnings(), getUsdNgnRate(), readWaves()]);
    return NextResponse.json({ claims, exchangeRate, waves }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[earnings:list:failed]", error);
    return NextResponse.json({ error: "Earnings are temporarily unavailable" }, { status: 503 });
  }
}
