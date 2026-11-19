// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignupPage from "../../app/(auth)/signup/page";
import { SignupForm } from "./signup-form";
import type { SignupResult, SignupService } from "./service";

afterEach(cleanup);
function mockService() {
  const checkUsername = vi
    .fn<SignupService["checkUsername"]>()
    .mockImplementation(async (username) => ({ username, status: "available" }));
  const register = vi
    .fn<SignupService["register"]>()
    .mockResolvedValue({ status: "confirmation_required" });
  const service: SignupService = { registrationEnabled: true, checkUsername, register };
  return { service, checkUsername, register };
}
function fill() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "person@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic password" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: " MaYa_7 " } });
}
const available = () =>
  screen.findByText(/^This username is currently available/, {}, { timeout: 2000 });

describe("signup UI with explicit service mocks", () => {
  it("renders the real page disabled without ever making a network request", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    render(<SignupPage />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(screen.getByText(/Signup is not available yet/)).toBeVisible();
    fill();
    await screen.findByText(/We can't check usernames right now/, {}, { timeout: 2000 });
    expect(screen.queryByText(/^This username is currently available/)).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("form", { name: "Create an account" }));
    expect(network).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });
  it("shows/hides passwords and validates fields inline", async () => {
    const { service, register } = mockService();
    render(<SignupForm service={service} />);
    const password = screen.getByLabelText("Password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
    fireEvent.blur(screen.getByLabelText("Email address"));
    fireEvent.blur(password);
    fireEvent.blur(screen.getByLabelText("Username"));
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(register).not.toHaveBeenCalled();
  });
  it("shows reserved suggestions immediately without a backend lookup", () => {
    const { service, checkUsername } = mockService();
    render(<SignupForm service={service} />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: " ADMIN " } });
    expect(screen.getByText("This username is reserved. Choose another name.")).toBeVisible();
    expect(screen.getByRole("button", { name: "admin_1" })).toBeInTheDocument();
    expect(screen.getByText(/Their availability has not been checked/)).toBeVisible();
    expect(checkUsername).not.toHaveBeenCalled();
  });
  it("shows taken messaging and rechecks a selected suggestion without claiming it is free", async () => {
    const { service, checkUsername } = mockService();
    checkUsername.mockImplementation(async (username) => ({ username, status: "taken" }));
    render(<SignupForm service={service} />);
    fill();
    await screen.findByText("This username is taken. Try another name.");
    checkUsername.mockImplementation(async (username) => ({ username, status: "available" }));
    await userEvent.click(screen.getByRole("button", { name: "maya_7_1" }));
    expect(screen.getByLabelText("Username")).toHaveValue("maya_7_1");
    expect(screen.getByText("Checking username…")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await available();
    expect(checkUsername.mock.calls.at(-1)?.[0]).toBe("maya_7_1");
  });
  it("requires confirmation without navigating or claiming a reservation", async () => {
    const { service, register } = mockService();
    render(<SignupForm service={service} />);
    fill();
    await available();
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText(/If registration can be completed, check your email/),
    ).toBeVisible();
    expect(register).toHaveBeenCalledWith({
      email: "person@example.invalid",
      password: "synthetic password",
      username: "maya_7",
    });
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(screen.queryByText(/Account created successfully/)).not.toBeInTheDocument();
  });
  it("prevents duplicate submissions and locks fields while registration is pending", async () => {
    let resolve!: (value: SignupResult) => void;
    const { service, register } = mockService();
    register.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<SignupForm service={service} />);
    fill();
    await available();
    fireEvent.submit(screen.getByRole("form", { name: "Create an account" }));
    fireEvent.submit(screen.getByRole("form", { name: "Create an account" }));
    expect(register).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Creating account…" })).toBeDisabled();
    expect(screen.getByLabelText("Username")).toBeDisabled();
    await act(async () => resolve({ status: "confirmation_required" }));
  });
  it("handles a final uniqueness race by rechecking rather than faking success", async () => {
    const { service, register, checkUsername } = mockService();
    register.mockResolvedValue({ status: "username_unavailable" });
    render(<SignupForm service={service} />);
    fill();
    await available();
    checkUsername.mockImplementation(async (username) => ({ username, status: "taken" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't complete registration");
    await screen.findByText("This username is taken. Try another name.");
    expect(screen.getByRole("button", { name: "maya_7_1" })).toBeVisible();
    expect(screen.queryByText(/check your email for a confirmation link/)).not.toBeInTheDocument();
  });
  it("sanitizes unexpected errors and never claims availability during backend failure", async () => {
    const { service, register, checkUsername } = mockService();
    register.mockRejectedValue(new Error("Private SQL and email detail"));
    render(<SignupForm service={service} />);
    fill();
    await available();
    checkUsername.mockRejectedValue(new Error("Database unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again later");
    expect(screen.queryByText("Private SQL and email detail")).not.toBeInTheDocument();
    await screen.findByText(/We can't check usernames right now/);
    expect(screen.queryByText(/^This username is currently available/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled(),
    );
  });
});
