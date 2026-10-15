import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthConfig } from "./lib/supabase/auth-config";
import { MAINTENANCE_COOKIE, maintenanceEnabled, maintenanceProtectedPath, validMaintenancePass } from "./lib/maintenance";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (maintenanceEnabled() && maintenanceProtectedPath(path) && !validMaintenancePass(request.cookies.get(MAINTENANCE_COOKIE)?.value)) {
    if (path.startsWith("/api/")) return NextResponse.json(
      { error: "Plinger is temporarily under maintenance. Please try again shortly.", maintenance: true },
      { status: 503, headers: { "Cache-Control": "private, no-store", "Retry-After": "300" } },
    );
    const response = NextResponse.redirect(new URL("/maintenance", request.url), 303);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  // Preserve existing session refresh behavior; API routes perform their own authorization.
  if (!path.startsWith("/dashboard") && !path.startsWith("/scouter") && path !== "/auth/callback") return NextResponse.next({ request });
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
  matcher: ["/dashboard/:path*", "/scouter/:path*", "/auth/callback", "/api/:path*", "/r/:path*"],
};
