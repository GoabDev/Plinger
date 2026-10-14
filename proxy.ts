import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "./lib/supabase/auth-config";

export async function proxy(request: NextRequest) {
  // Supabase can fall back to its Site URL when the requested callback is not
  // allowlisted. Finish the exchange before rendering the public homepage.
  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code");
    const failed = request.nextUrl.searchParams.has("error") || request.nextUrl.searchParams.has("error_code");
    if (code || failed) {
      const destination = new URL(failed ? "/scouter/login?error=oauth" : "/auth/callback", request.url);
      if (!failed && code) {
        destination.searchParams.set("code", code);
        destination.searchParams.set("next", "/scouter");
        destination.searchParams.set("recovery", "site");
        const intent = request.nextUrl.searchParams.get("referralIntent");
        if (intent) destination.searchParams.set("referralIntent", intent);
      }
      const response = NextResponse.redirect(destination);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    return NextResponse.next({ request });
  }
  const config = getAuthConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/scouter/:path*", "/auth/callback"],
};
