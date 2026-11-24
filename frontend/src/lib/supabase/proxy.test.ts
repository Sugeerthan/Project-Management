import type { CookieMethodsServer } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateAuthSession } from "./proxy";
import { config } from "../../proxy";

const sdk = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: sdk.createServerClient }));
const request = (pathname: string) => new NextRequest(`https://nexus.example.invalid${pathname}`);
const adapter = () =>
  (sdk.createServerClient.mock.calls[0][2] as { cookies: CookieMethodsServer }).cookies;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", `sb_publishable_${"a".repeat(32)}`);
  sdk.createServerClient.mockReturnValue({ auth: { getClaims: sdk.getClaims } });
  sdk.getClaims.mockResolvedValue({ data: null, error: null });
});

describe("Next.js auth proxy (mocked Supabase)", () => {
  it("refreshes homepage sessions and prevents caching personalized navigation", async () => {
    expect(config.matcher).toContain("/");
    const response = await updateAuthSession(request("/"));
    expect(sdk.getClaims).toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("redirects unauthenticated dashboard requests with no public caching", async () => {
    const response = await updateAuthSession(request("/dashboard?next=https://evil.example"));
    expect(response.headers.get("location")).toBe(
      "https://nexus.example.invalid/login?next=%2Fdashboard",
    );
    expect(response.headers.get("cache-control")).toContain("private, no-store");
  });
  it("allows verified dashboard access but leaves login routing to the fresh server check", async () => {
    sdk.getClaims.mockResolvedValue({
      data: { claims: { sub: "test-user", is_anonymous: false } },
      error: null,
    });
    expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toBeNull();
    expect(
      (await updateAuthSession(request("/login?next=//evil.example"))).headers.get("location"),
    ).toBeNull();
  });
  it("does not loop login back to a dashboard that a fresh user check can reject", async () => {
    // Valid JWT claims can outlive account removal or an Auth-service failure.
    // The login page's getUser() check must be allowed to fail without a loop.
    sdk.getClaims.mockResolvedValue({ data: { claims: { sub: "stale-user" } }, error: null });
    const response = await updateAuthSession(request("/login"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("denies forged/unverified and anonymous identities", async () => {
    for (const result of [
      { data: { claims: { sub: "forged" } }, error: new Error("Bad signature") },
      { data: { claims: { sub: "anon", is_anonymous: true } }, error: null },
      { data: { claims: {} }, error: null },
    ]) {
      sdk.getClaims.mockResolvedValue(result);
      expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toContain(
        "/login",
      );
    }
  });
  it("preserves refreshed cookie chunks in request, response and redirects", async () => {
    sdk.getClaims.mockImplementation(async () => {
      await adapter().setAll?.(
        [
          {
            name: "sb-test-auth-token.0",
            value: "synthetic-0",
            options: { httpOnly: false, path: "/", secure: true },
          },
          {
            name: "sb-test-auth-token.1",
            value: "synthetic-1",
            options: { path: "/", secure: true },
          },
        ],
        { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" },
      );
      return { data: null, error: null };
    });
    const incoming = request("/dashboard");
    const response = await updateAuthSession(incoming);
    expect(incoming.cookies.get("sb-test-auth-token.0")?.value).toBe("synthetic-0");
    expect(response.cookies.get("sb-test-auth-token.1")?.value).toBe("synthetic-1");
    expect(response.cookies.get("sb-test-auth-token.1")?.secure).toBe(true);
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
  it("passes refreshed request and response cookies to an authorized dashboard", async () => {
    sdk.getClaims.mockImplementation(async () => {
      await adapter().setAll?.(
        [
          {
            name: "sb-test-auth-token",
            value: "refreshed-synthetic",
            options: { path: "/", secure: true },
          },
        ],
        { "Cache-Control": "private, no-store" },
      );
      return { data: { claims: { sub: "test-user" } }, error: null };
    });
    const incoming = request("/dashboard");
    const response = await updateAuthSession(incoming);
    expect(incoming.cookies.get("sb-test-auth-token")?.value).toBe("refreshed-synthetic");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("refreshed-synthetic");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("retains cookies from multiple setAll calls", async () => {
    sdk.getClaims.mockImplementation(async () => {
      await adapter().setAll?.([{ name: "chunk-a", value: "a", options: { path: "/" } }], {});
      await adapter().setAll?.([{ name: "chunk-b", value: "b", options: { path: "/" } }], {});
      return { data: null, error: null };
    });
    const response = await updateAuthSession(request("/dashboard"));
    expect(response.cookies.get("chunk-a")?.value).toBe("a");
    expect(response.cookies.get("chunk-b")?.value).toBe("b");
  });
  it("forwards cookie deletion on refresh failure", async () => {
    sdk.getClaims.mockImplementation(async () => {
      await adapter().setAll?.(
        [{ name: "sb-test-auth-token", value: "", options: { path: "/", maxAge: 0 } }],
        {},
      );
      throw new Error("Expired refresh token");
    });
    const response = await updateAuthSession(request("/dashboard"));
    expect(response.cookies.get("sb-test-auth-token")?.maxAge).toBe(0);
    expect(response.headers.get("location")).toContain("/login");
  });
  it("fails closed when config is missing without calling Supabase", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toContain(
      "/login",
    );
    expect((await updateAuthSession(request("/login"))).headers.get("location")).toBeNull();
    expect(sdk.createServerClient).not.toHaveBeenCalled();
  });
  it("checks cookies anew on reload and denies post-logout access", async () => {
    sdk.getClaims
      .mockResolvedValueOnce({ data: { claims: { sub: "test-user" } }, error: null })
      .mockResolvedValueOnce({ data: { claims: { sub: "test-user" } }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toBeNull();
    expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toBeNull();
    expect((await updateAuthSession(request("/dashboard"))).headers.get("location")).toContain(
      "/login",
    );
    expect(sdk.createServerClient).toHaveBeenCalledTimes(3);
  });
});
