"use server";

import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { MAINTENANCE_COOKIE, maintenanceEnabled, validMaintenancePass } from "../../../lib/maintenance";
import { createAuthClient } from "../../../lib/supabase/auth-client";

export async function signInWithGitHub() {
  if (maintenanceEnabled() && !validMaintenancePass((await cookies()).get(MAINTENANCE_COOKIE)?.value)) redirect("/maintenance");
  const auth = await createAuthClient();
  if (!auth) redirect("/scouter/login?error=config");
  const requestHeaders = await headers();
  const site = requestHeaders.get("origin") || process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
  const { data, error } = await auth.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: `${site}/auth/callback?next=/scouter` },
  });
  if (error || !data.url) redirect("/scouter/login?error=oauth");
  redirect(data.url);
}

export async function signOutScouter() {
  (await cookies()).delete(MAINTENANCE_COOKIE);
  const auth = await createAuthClient();
  if (auth) await auth.auth.signOut();
  redirect("/scouter/login");
}
