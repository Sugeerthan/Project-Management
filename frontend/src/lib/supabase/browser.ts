"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

export function createBrowserAuthClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Sign-in is temporarily unavailable.");
  // The SSR library uses cookies and a browser singleton, not custom token storage.
  return createBrowserClient(config.url, config.publishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: window.location.protocol === "https:",
    },
  });
}
