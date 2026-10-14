import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { githubAccountId, serviceClient } from "../../lib/scouter/portal";
import { signupPending } from "../../lib/referrals/server";
import ScouterPortal from "./portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scouter workspace", robots: { index: false, follow: false } };

export default async function ScouterPage() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!githubAccountId(data.user)) redirect("/scouter/login");
  if (await signupPending()) redirect("/scouter/onboarding");
  const member = await serviceClient().from("scouter_members").select("account_id").eq("account_id", githubAccountId(data.user)!).maybeSingle();
  if (member.error || !member.data) redirect("/scouter/onboarding");
  return <ScouterPortal />;
}
