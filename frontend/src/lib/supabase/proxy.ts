import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DASHBOARD_PATH, hasVerifiedIdentity, LOGIN_PATH } from "../../features/auth/routing";
import { getSupabasePublicConfig } from "./config";

function privateResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabasePublicConfig();
  let authenticated = false;
  if (config) {
    const client = createServerClient(config.url, config.publishableKey, {
      cookieOptions: { path: "/", sameSite: "lax", secure: request.nextUrl.protocol === "https:" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Downstream Server Components must see refreshed/removed cookies too.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const previous = response.cookies.getAll();
          response = NextResponse.next({ request });
          previous.forEach((cookie) => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    try {
      const { data, error } = await client.auth.getClaims();
      authenticated = !error && hasVerifiedIdentity(data?.claims);
    } catch {
      authenticated = false;
    }
  }
  const protectedPath =
    request.nextUrl.pathname === DASHBOARD_PATH ||
    request.nextUrl.pathname.startsWith(`${DASHBOARD_PATH}/`);
  // Let /login's fresh getUser() check decide whether to redirect. Valid claims
  // alone can outlive a removed user or an Auth failure; redirecting here would
  // loop /dashboard -> /login -> /dashboard when its server check rejects access.
  if (!authenticated && protectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    url.searchParams.set("next", DASHBOARD_PATH);
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    response = redirected;
  }
  // Explicitly no-store on every auth response, including errors and redirects.
  return privateResponse(response);
}
