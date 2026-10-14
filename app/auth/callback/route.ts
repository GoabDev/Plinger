import { NextResponse } from "next/server";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { cookies } from "next/headers";
import { canonicalOrigin, completeSignup, referralAttemptCookie, REFERRAL_COOKIE } from "../../../lib/referrals/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/scouter" ? "/scouter" : "/login";
  if (code) {
    const auth = await createAuthClient();
    if (auth) {
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error) {
        if (next === "/scouter") {
          const jar = await cookies();
          const intent = url.searchParams.get("referralIntent");
          const validIntent = intent && /^[0-9a-f-]{36}$/i.test(intent) && jar.get(referralAttemptCookie(intent))?.value === intent;
          // Bind attribution to this OAuth attempt, even if another tab starts signing in.
          if (intent) jar.set(REFERRAL_COOKIE, validIntent ? intent : "invalid", { httpOnly: true, secure: canonicalOrigin().startsWith("https:"), sameSite: "lax", path: "/", maxAge: 7 * 86400 });
          if (intent && !validIntent) return NextResponse.redirect(new URL("/scouter/onboarding?error=invalid", url.origin));
          const { data } = await auth.auth.getUser();
          let result = "unavailable";
          try { if (data.user) result = await completeSignup(data.user, intent); } catch { /* Retry after OAuth succeeds. */ }
          if (result !== "complete") return NextResponse.redirect(new URL(`/scouter/onboarding?error=${encodeURIComponent(result)}`, url.origin));
          jar.delete(REFERRAL_COOKIE);
          if (intent) jar.delete(referralAttemptCookie(intent));
        }
        return NextResponse.redirect(new URL(next, url.origin));
      }
    }
  }
  return NextResponse.redirect(new URL("/scouter/login?error=oauth", url.origin));
}
