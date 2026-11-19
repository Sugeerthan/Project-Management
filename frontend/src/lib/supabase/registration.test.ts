import { describe, expect, it, vi } from "vitest";
import { createRegistrationAuthClient } from "./registration";

const sdk = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: sdk.createClient }));
describe("isolated signup client", () => {
  it("never uses browser cookie/session persistence", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `sb_publishable_${"a".repeat(32)}`);
    createRegistrationAuthClient();
    expect(sdk.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      expect.any(String),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "nexus-signup-no-session",
        },
      },
    );
  });
  it("fails safely when public configuration is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createRegistrationAuthClient()).toThrow("Signup is temporarily unavailable.");
    expect(sdk.createClient).not.toHaveBeenCalled();
  });
});
