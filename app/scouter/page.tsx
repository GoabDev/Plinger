import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "../ui/brand";
import { signOut } from "../login/actions";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { githubAccountId } from "../../lib/scouter/portal";
import ScouterPortal from "./portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scouter workspace", robots: { index: false, follow: false } };

export default async function ScouterPage() {
  const auth = await createAuthClient();
  const { data } = auth ? await auth.auth.getUser() : { data: { user: null } };
  if (!githubAccountId(data.user)) redirect("/scouter/login");
  return <main className="scouter-shell">
    <header className="scouter-topbar"><Brand /><form action={signOut}><button type="submit" className="button button-white">Sign out</button></form></header>
    <ScouterPortal />
  </main>;
}
