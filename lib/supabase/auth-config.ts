import type { User } from "@supabase/supabase-js";

export function getAuthConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  return url && publishableKey ? { url, publishableKey } : null;
}

export function isAdmin(user: User | null) {
  const email = process.env.PLINGER_ADMIN_EMAIL;

  return Boolean(
    email &&
      user?.email_confirmed_at &&
      user.email?.toLowerCase() === email.toLowerCase(),
  );
}
