import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser, requireAuthenticatedUser } from "./server";
import DashboardPage from "../../app/(customer)/dashboard/page";
import LoginPage from "../../app/(auth)/login/page";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../lib/supabase/server", () => ({ createServerAuthClient: mocks.client }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => {
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
describe("independent server authorization", () => {
  it("returns only the Auth-server-verified user", async () => {
    const user = { id: "test-user", email: "person@example.invalid", is_anonymous: false };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect(await requireAuthenticatedUser()).toEqual(user);
    expect(await DashboardPage()).toBeTruthy();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });
  it("redirects even when dashboard is called directly without proxy", async () => {
    await expect(DashboardPage()).rejects.toThrow("redirect:/login");
  });
  it("denies errors and anonymous accounts", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "anon", is_anonymous: true } },
      error: null,
    });
    expect(await getAuthenticatedUser()).toBeNull();
    mocks.getUser.mockRejectedValue(new Error("Private upstream details"));
    await expect(requireAuthenticatedUser()).rejects.toThrow("redirect:/login");
  });
  it("handles missing configuration safely", async () => {
    mocks.client.mockResolvedValue(null);
    expect(await getAuthenticatedUser()).toBeNull();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("redirects an already authenticated login visitor to a safe page", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "test-user" } }, error: null });
    await expect(
      LoginPage({ searchParams: Promise.resolve({ next: "https://evil.example" }) }),
    ).rejects.toThrow("redirect:/dashboard");
  });
  it("renders login rather than redirecting when the fresh Auth check fails", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("User unavailable") });
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
