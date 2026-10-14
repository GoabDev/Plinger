"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createHmac } from "node:crypto";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { canonicalOrigin, referralPreview, referralAttemptCookie, REFERRAL_COOKIE } from "../../../lib/referrals/server";
import { parseReferralCode } from "../../../lib/referrals/contracts";
import { serviceClient } from "../../../lib/scouter/portal";

export async function checkReferral(value: string) {
  const code = parseReferralCode(value, canonicalOrigin());
  if (!code) return { error: "Enter a valid Plinger referral link." };
  try {
    const preview = await referralPreview(code);
    if (!preview) return { error: "This link is unavailable or no wave is accepting referrals." };
    return { code, login: preview.login, waveName: preview.wave.name, waveId: preview.wave.id };
  } catch { return { error: "Could not check the referral. Please try again." }; }
}

export async function signInWithGitHub(form: FormData) {
  const auth = await createAuthClient();
  if (!auth) redirect("/scouter/login?error=config");
  const site = canonicalOrigin();
  const jar = await cookies();
  const input = String(form.get("referral") ?? "").trim();
  let referralIntent: string | null = null;
  if (input) {
    const code = parseReferralCode(input, site);
    if (!code) redirect("/scouter/login?error=referral");
    let intent: string | null = null;
    try {
      const preview = await referralPreview(code);
      if (preview && preview.wave.id === form.get("expectedWave")) {
        const requestHeaders = await headers();
        const visitor = requestHeaders.get("x-vercel-forwarded-for") || requestHeaders.get("x-forwarded-for") || "local";
        const hash = createHmac("sha256", process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!).update(visitor.split(",")[0].trim()).digest("hex");
        const result = await serviceClient().rpc("create_referral_intent", { p_code: code, p_visitor: hash });
        if (!result.error) intent = result.data;
      }
    } catch { /* Do not silently discard a requested referral. */ }
    if (!intent) redirect(`/scouter/login?error=referral&ref=${code}`);
    jar.set(REFERRAL_COOKIE, intent, { httpOnly: true, secure: site.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    jar.set(referralAttemptCookie(intent), intent, { httpOnly: true, secure: site.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 7 * 86400 });
    referralIntent = intent;
  } else jar.delete(REFERRAL_COOKIE);
  const { data, error } = await auth.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${site}/auth/callback?next=/scouter${referralIntent ? `&referralIntent=${referralIntent}` : ""}` },
  });
  if (error || !data.url) redirect("/scouter/login?error=oauth");
  redirect(data.url);
}

export async function signOutScouter() {
  const auth = await createAuthClient();
  if (auth) await auth.auth.signOut();
  redirect("/scouter/login");
}
