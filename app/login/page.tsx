import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "../ui/brand";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { isAdmin } from "../../lib/supabase/auth-config";
import { LoginForm } from "./form";
import { ThemeToggle } from "../ui/theme-toggle";
import { maintenanceEnabled } from "../../lib/maintenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Login({ searchParams }: { searchParams: Promise<{ developer?: string }> }) {
  const developer = maintenanceEnabled() && (await searchParams).developer === "1";
  const supabase = await createAuthClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (isAdmin(data.user) && !maintenanceEnabled()) redirect("/dashboard");
  }

  return (
    <main className="login-shell">
      <ThemeToggle className="fixed right-4 top-4 z-10 sm:right-6 sm:top-6" />
      <div className="login-brand-panel">
        <Brand />
        <p>Repository activity, all in one place.</p>
      </div>
      <div className="login-content">
        <div className="login-content-inner">
          <p className="overline">PLINGER WORKSPACE</p>
          <h1>{developer ? "Developer access" : "Welcome back"}</h1>
          <p className="login-intro">{developer ? "Use your admin credentials to access Plinger during maintenance." : "Sign in to your dashboard."}</p>
          <LoginForm />
          <a className="scouter-admin-link" href="/scouter/login">Scouter sign in with GitHub</a>
        </div>
      </div>
    </main>
  );
}
