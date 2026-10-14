import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "../../ui/brand";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { githubAccountId } from "../../../lib/scouter/portal";
import ReferralLoginForm from "./referral-form";
import { referralPreview, signupPending } from "../../../lib/referrals/server";
import { z } from "zod";
import { ThemeToggle } from "../../ui/theme-toggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scouter sign in", robots: { index: false, follow: false } };

export default async function ScouterLogin({ searchParams }: { searchParams: Promise<{ error?: string; ref?: string }> }) {
  const auth = await createAuthClient();
  if (auth) {
    const { data } = await auth.auth.getUser();
    if (githubAccountId(data.user)) redirect(await signupPending() ? "/scouter/onboarding" : "/scouter");
  }
  const { error, ref } = await searchParams;
  const code = z.uuid().safeParse(ref).success ? ref! : "";
  const preview = code ? await referralPreview(code).catch(() => null) : null;
  return <main className="login-shell scouter-login-shell">
    <ThemeToggle className="fixed right-4 top-4 z-10 sm:right-6 sm:top-6" />
    <div className="login-brand-panel"><Brand /><p>Scouter workspace</p></div>
    <div className="login-content"><div className="login-content-inner">
      <p className="overline">SCOUTER ACCESS</p>
      <h1>Sign in with GitHub</h1>
      <p className="login-intro">Open your assigned work and withdrawal details.</p>
      {error && <p className="login-error" role="alert">{error === "config" ? "Sign-in is not configured yet." : error === "referral" ? "This referral is unavailable or no wave is accepting referrals. Check the link or continue without a referral." : "GitHub sign-in did not complete. Please try again."}</p>}
      <ReferralLoginForm initialRef={code} preview={preview ? { login: preview.login, waveName: preview.wave.name, waveId: preview.wave.id } : null} />
    </div></div>
    <a className="scouter-admin-link" href="/login">Admin sign in</a>
  </main>;
}
