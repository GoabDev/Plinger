"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { isAdmin } from "../../lib/supabase/auth-config";

type SignInState = { error: string | null };

export async function signIn(
  _state: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const supabase = await createAuthClient();

  if (!supabase) return { error: "Sign-in is not configured yet." };
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Enter your email and password." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error || !isAdmin(data.user)) {
    if (data.user) await supabase.auth.signOut();
    return { error: "Invalid credentials." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createAuthClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
