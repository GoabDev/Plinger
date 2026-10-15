import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { REFERRAL_COOKIE, parseReferralCookie, referralCookie, referralsEnabled } from "../../../lib/referrals/server";
import { referralsOpen, WAVE_END } from "../../../lib/referrals/rules";
import { serviceClient } from "../../../lib/scouter/portal";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const response = NextResponse.redirect(new URL("/scouter/login", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const { code } = await params;
  if (!referralsEnabled() || !referralsOpen() || !/^[\da-f-]{36}$/.test(code)) return response;
  try {
    const existing = (await cookies()).get(REFERRAL_COOKIE)?.value;
    if (existing && parseReferralCookie(existing)) return response;
    const result = await serviceClient().from("wave10_referral_codes").select("account_id").eq("code", code).maybeSingle();
    if (result.error) throw result.error;
    if (result.data) response.cookies.set(REFERRAL_COOKIE, referralCookie(code), {
      httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "lax", path: "/", expires: new Date(WAVE_END),
    });
  } catch (error) { console.error("[referral:link]", error); }
  return response;
}
