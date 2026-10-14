"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { completeSignup, referralAttemptCookie, REFERRAL_COOKIE } from "../../../lib/referrals/server";

export async function finishOnboarding(form: FormData) {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect("/scouter/login");
  const jar = await cookies();
  const intent = form.get("skip") === "yes" ? null : jar.get(REFERRAL_COOKIE)?.value ?? null;
  let result = "unavailable";
  try { result = await completeSignup(data.user, intent, true); } catch { /* Keep the intent for recovery. */ }
  if (result !== "complete") redirect(`/scouter/onboarding?error=${encodeURIComponent(result)}`);
  jar.delete(REFERRAL_COOKIE);
  if (intent) jar.delete(referralAttemptCookie(intent));
  redirect("/scouter");
}
