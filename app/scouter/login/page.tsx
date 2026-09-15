import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "../../ui/brand";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { githubAccountId } from "../../../lib/scouter/portal";
import { signInWithGitHub } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scouter sign in", robots: { index: false, follow: false } };

export default async function ScouterLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const auth = await createAuthClient();
  if (auth) {
    const { data } = await auth.auth.getUser();
    if (githubAccountId(data.user)) redirect("/scouter");
  }
  const { error } = await searchParams;
  return <main className="login-shell scouter-login-shell">
    <div className="login-brand-panel"><Brand /><p>Scouter workspace</p></div>
    <div className="login-content"><div className="login-content-inner">
      <p className="overline">SCOUTER ACCESS</p>
      <h1>Sign in with GitHub</h1>
      <p className="login-intro">Open your assigned work and withdrawal details.</p>
      {error && <p className="login-error" role="alert">{error === "config" ? "Sign-in is not configured yet." : "GitHub sign-in did not complete. Please try again."}</p>}
      <form className="scouter-oauth-form" action={signInWithGitHub}><button className="button button-black login-submit" type="submit"><img src="/github-mark-white.svg" width={20} height={20} alt="" aria-hidden="true" /> Continue with GitHub</button></form>
    </div></div>
    <a className="scouter-admin-link" href="/login">Admin sign in</a>
  </main>;
}
