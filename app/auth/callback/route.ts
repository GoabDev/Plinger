import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { captureReferral, REFERRAL_COOKIE } from "../../../lib/referrals/server";
import { createAuthClient } from "../../../lib/supabase/auth-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/scouter" ? "/scouter" : "/login";
  if (code) {
    const auth = await createAuthClient();
    if (auth) {
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error) {
        const cookieStore = await cookies();
        const referral = cookieStore.get(REFERRAL_COOKIE)?.value;
        if (next === "/scouter" && referral) {
          try {
            const { data } = await auth.auth.getUser();
            if (data.user) await captureReferral(data.user, referral);
            cookieStore.delete(REFERRAL_COOKIE);
          } catch (cause) { console.error("[referral:signup]", cause); }
        }
        return NextResponse.redirect(new URL(next, url.origin));
      }
    }
  }
  return NextResponse.redirect(new URL("/scouter/login?error=oauth", url.origin));
}
