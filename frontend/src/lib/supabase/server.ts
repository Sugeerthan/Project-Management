import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

/** A fresh request-scoped client. Never share one server client across users. */
export async function createServerAuthClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. The matching proxy refreshes
          // request AND response cookies before these pages render.
        }
      },
    },
  });
}
