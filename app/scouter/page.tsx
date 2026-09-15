import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { githubAccountId } from "../../lib/scouter/portal";
import ScouterPortal from "./portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scouter workspace", robots: { index: false, follow: false } };

export default async function ScouterPage() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!githubAccountId(data.user)) redirect("/scouter/login");
  return <ScouterPortal />;
}
