import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabasePublicConfig } from "./config";

const key = `sb_publishable_${"a".repeat(32)}`; // Synthetic configuration only.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", key);
});
describe("public Auth configuration", () => {
  it("accepts HTTPS Supabase origins and local HTTP", () => {
    expect(getSupabasePublicConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: key,
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    expect(getSupabasePublicConfig()?.url).toBe("http://localhost:54321");
  });
  it.each([
    "",
    "not-a-url",
    "http://remote.example",
    "javascript:alert(1)",
    "https://user:pass@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid?secret=1",
  ])("fails safely for invalid URL %j", (url) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    expect(getSupabasePublicConfig()).toBeNull();
  });
  it.each(["", "sb_secret_test-only", "service-role-key", "anon-jwt", "sb_publishable_short"])(
    "rejects missing, privileged or unsupported key %j",
    (value) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", value);
      expect(getSupabasePublicConfig()).toBeNull();
    },
  );
});
