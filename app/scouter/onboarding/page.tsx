import { redirect } from "next/navigation";
import { createAuthClient } from "../../../lib/supabase/auth-client";
import { finishOnboarding } from "./actions";
export const dynamic = "force-dynamic";
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect("/scouter/login");
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    existing: "This GitHub account already joined Plinger and cannot receive a new referral attribution.",
    expired: "Your referral signup attempt expired. Retry to finish it in the same wave, or explicitly continue without a referral.",
    wave_changed: "The wave changed while you were signing in. Your referral has not been attributed. Contact the admin before continuing if you want to retain it.",
    invalid: "This referral is unavailable or belongs to your own account.",
    redirect: "Your GitHub sign-in succeeded, but the return link lost your referral details. Finish your saved referral signup below, or choose to continue without a referral.",
  };
  return <main className="login-shell"><div className="login-content"><div className="login-content-inner"><h1>Finish joining Plinger</h1><p role="status">{messages[error ?? ""] || "Your GitHub sign-in succeeded. Finish saving your signup before entering the workspace."}</p>
    <form action={finishOnboarding} className="scouter-form"><button className="button button-black">{error === "redirect" ? "Finish referral signup" : "Retry signup"}</button></form>
    <form action={finishOnboarding} className="scouter-form"><input type="hidden" name="skip" value="yes" /><p>Continuing without a referral makes your signup final. You cannot add a referrer later.</p><button className="button button-white">Continue without a referral</button></form>
  </div></div></main>;
}
