// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import { LogoutButton } from "./logout-button";
import { SessionBoundary } from "./session-boundary";

const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getClaims: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../../lib/supabase/browser", () => ({ createBrowserAuthClient: mocks.client }));
vi.mock("./navigation", () => ({ replaceAuthLocation: mocks.navigate }));
const success = {
  data: { session: { access_token: "synthetic-only" }, user: { is_anonymous: false } },
  error: null,
};
let authEvent: (event: string) => void;
beforeEach(() => {
  mocks.client.mockReturnValue({
    auth: {
      signInWithPassword: mocks.signIn,
      signOut: mocks.signOut,
      getClaims: mocks.getClaims,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  });
  mocks.signIn.mockResolvedValue(success);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "test-user" } }, error: null });
  mocks.onAuthStateChange.mockImplementation((callback: (event: string) => void) => {
    authEvent = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
});
afterEach(cleanup);
function fillLogin() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: " test-password " } });
}

describe("login form (mocked Supabase)", () => {
  it("labels fields and reports accessible validation without a request", async () => {
    render(<LoginForm configured nextPath="/dashboard" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("signs in and fully navigates only to an allowlisted local destination", async () => {
    render(<LoginForm configured nextPath="//evil.example" />);
    fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "person@example.invalid",
      password: " test-password ",
    });
  });
  it("handles invalid credentials without exposing upstream details", async () => {
    mocks.signIn.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "private internal details" },
    });
    render(<LoginForm configured nextPath="/dashboard" />);
    fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
    expect(screen.queryByText("private internal details")).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("locks duplicate submissions before React rerenders and shows loading", async () => {
    let resolve!: (value: typeof success) => void;
    mocks.signIn.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<LoginForm configured nextPath="/dashboard" />);
    fillLogin();
    fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));
    fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    await act(async () => resolve(success));
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard");
  });
  it("handles network failures and disabled configuration safely", async () => {
    mocks.signIn.mockRejectedValue(new Error("Network details"));
    const view = render(<LoginForm configured nextPath="/dashboard" />);
    fillLogin();
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    view.unmount();
    render(<LoginForm configured={false} nextPath="/dashboard" />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("temporarily unavailable");
  });
});

describe("logout (mocked Supabase)", () => {
  it("ends this browser session and performs a full login navigation", async () => {
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/login"));
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("keeps failures visible, private and retryable", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("Private upstream details") });
    render(<LogoutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't sign you out");
    expect(screen.getByRole("button", { name: "Logout" })).toBeEnabled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
  it("prevents duplicate logout while the request is pending", async () => {
    let resolve!: (value: { error: null }) => void;
    mocks.signOut.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<LogoutButton />);
    const button = screen.getByRole("button", { name: "Logout" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    await act(async () => resolve({ error: null }));
  });
});

describe("dashboard UI session guard", () => {
  const show = () =>
    render(
      <SessionBoundary userId="test-user">
        <p>person@example.invalid</p>
      </SessionBoundary>,
    );
  it("does not render private content until browser claims verify", async () => {
    let resolve!: (value: { data: { claims: { sub: string } }; error: null }) => void;
    mocks.getClaims.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checking your session");
    await act(async () => resolve({ data: { claims: { sub: "test-user" } }, error: null }));
    expect(screen.getByText("person@example.invalid")).toBeVisible();
  });
  it("hides cached data on pagehide and rechecks history restoration after logout", async () => {
    show();
    expect(await screen.findByText("person@example.invalid")).toBeVisible();
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(screen.getByText("person@example.invalid")).not.toBeVisible();
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    act(() => window.dispatchEvent(new Event("pageshow")));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
  });
  it("clears UI immediately when another tab signs out", async () => {
    const view = show();
    await screen.findByText("person@example.invalid");
    act(() => authEvent("SIGNED_OUT"));
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
  it("never reveals a previous user's content if the account changes", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "other-user" } }, error: null });
    show();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/dashboard"));
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
  });
  it("fails closed on browser configuration and verification failures", async () => {
    mocks.client.mockImplementationOnce(() => {
      throw new Error("Missing configuration");
    });
    const view = show();
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
    view.unmount();
    mocks.getClaims.mockRejectedValue(new Error("Network"));
    show();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
  });
  it("does not let an in-flight verification reveal data after sign-out", async () => {
    let resolve!: (value: { data: { claims: { sub: string } }; error: null }) => void;
    mocks.getClaims.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    show();
    act(() => authEvent("SIGNED_OUT"));
    await act(async () => resolve({ data: { claims: { sub: "test-user" } }, error: null }));
    expect(screen.queryByText("person@example.invalid")).not.toBeInTheDocument();
  });
});
