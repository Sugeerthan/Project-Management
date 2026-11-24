// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), connection: vi.fn() }));
vi.mock("../features/auth/server", () => ({ getAuthenticatedUser: mocks.getUser }));
vi.mock("next/server", () => ({ connection: mocks.connection }));
vi.mock("../features/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">Logout</button>,
}));

afterEach(cleanup);

describe("homepage account navigation", () => {
  it("links visitors to the existing login and signup routes and explains availability", async () => {
    mocks.getUser.mockResolvedValue(null);
    render(await HomePage());
    const nav = screen.getByRole("navigation", { name: "Account" });
    expect(within(nav).getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
    expect(within(nav).getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute("href", "/signup");
    expect(screen.getByText("Registration and portfolio creation are coming soon.")).toBeVisible();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("shows dashboard and the existing logout control for a verified user", async () => {
    mocks.getUser.mockResolvedValue({ id: "synthetic-user" });
    render(await HomePage());
    const nav = screen.getByRole("navigation", { name: "Account" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(nav).getByRole("button", { name: "Logout" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(nav).queryByRole("link", { name: "Sign Up" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Login" })).not.toBeInTheDocument();
    expect(mocks.connection).toHaveBeenCalled();
  });
});
