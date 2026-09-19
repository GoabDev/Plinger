"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "../../lib/supabase/auth-client";
import { isAdmin } from "../../lib/supabase/auth-config";
import { adminSignInSchema } from "../../lib/auth/contracts";

export type SignInState = {
  error: string | null;
  fieldErrors: { email?: string; password?: string };
};

export async function signIn(
  _state: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const supabase = await createAuthClient();

  if (!supabase) return { error: "Sign-in is not configured yet.", fieldErrors: {} };
  const parsed = adminSignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: { email: fields.email?.[0], password: fields.password?.[0] },
    };
  }
  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !isAdmin(data.user)) {
    if (data.user) await supabase.auth.signOut();
    return { error: "Invalid credentials.", fieldErrors: {} };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createAuthClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
