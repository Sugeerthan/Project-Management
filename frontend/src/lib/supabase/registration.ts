"use client";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Signup must not persist a session or overwrite the existing SSR login session.
 * Only the gated registration service may call this factory. It is disconnected
 * in the shipped application until the username integration is approved.
 */
export function createRegistrationAuthClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Signup is temporarily unavailable.");
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "nexus-signup-no-session",
    },
  });
}
