import type { CookieMethodsServer } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerAuthClient } from "./server";
import { createBrowserAuthClient } from "./browser";

const sdk = vi.hoisted(() => ({
  server: vi.fn(),
  browser: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: sdk.server,
  createBrowserClient: sdk.browser,
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: sdk.getAll, set: sdk.set }) }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `sb_publishable_${"a".repeat(32)}`);
  sdk.getAll.mockReturnValue([{ name: "sb-test", value: "synthetic-cookie" }]);
  sdk.set.mockImplementation(() => undefined);
});
describe("SSR client adapters (mocked SDK)", () => {
  it("creates fresh server clients and reads the incoming cookie session", async () => {
    await createServerAuthClient();
    await createServerAuthClient();
    expect(sdk.server).toHaveBeenCalledTimes(2);
    const cookies = (sdk.server.mock.calls[0][2] as { cookies: CookieMethodsServer }).cookies;
    expect(await cookies.getAll()).toEqual([{ name: "sb-test", value: "synthetic-cookie" }]);
    await cookies.setAll?.([{ name: "sb-test", value: "renewed", options: { path: "/" } }], {});
    expect(sdk.set).toHaveBeenCalledWith("sb-test", "renewed", { path: "/" });
  });
  it("tolerates read-only Server Component cookie stores", async () => {
    sdk.set.mockImplementation(() => {
      throw new Error("Read only");
    });
    await createServerAuthClient();
    const cookies = (sdk.server.mock.calls[0][2] as { cookies: CookieMethodsServer }).cookies;
    await expect(
      Promise.resolve(cookies.setAll?.([{ name: "sb-test", value: "renewed", options: {} }], {})),
    ).resolves.toBeUndefined();
  });
  it("does not create a server client when configuration is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await createServerAuthClient()).toBeNull();
    expect(sdk.server).not.toHaveBeenCalled();
  });
  it("fails browser creation safely without configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createBrowserAuthClient()).toThrow("temporarily unavailable");
  });
});
