import { NextResponse } from "next/server";
import { createAuthClient } from "../../../lib/supabase/auth-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") === "/scouter" ? "/scouter" : "/login";
  if (code) {
    const auth = await createAuthClient();
    if (auth) {
      const { error } = await auth.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/scouter/login?error=oauth", url.origin));
}
