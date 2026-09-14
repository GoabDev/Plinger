import { redirect } from "next/navigation";
import { Brand } from "../ui/brand";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { isAdmin } from "../../lib/supabase/auth-config";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Login() {
  const supabase = await createAuthClient();
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    if (isAdmin(data.user)) redirect("/dashboard");
  }

  return (
    <main className="login-shell">
      <div className="login-brand-panel">
        <Brand />
        <p>Repository activity, all in one place.</p>
      </div>
      <div className="login-content">
        <div className="login-content-inner">
          <p className="overline">PLINGER WORKSPACE</p>
          <h1>Welcome back</h1>
          <p className="login-intro">Sign in to your dashboard.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
