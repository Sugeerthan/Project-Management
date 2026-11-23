export type SupabasePublicConfig = { url: string; publishableKey: string };

/** Lazy validation: public pages and builds do not require Auth configuration. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  // Keep direct property references: Next.js inlines NEXT_PUBLIC_ values in browsers.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key) || key.length > 1024) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/" ||
      url !== url.trim()
    )
      return null;
    return { url: parsed.origin, publishableKey: key };
  } catch {
    return null;
  }
}
