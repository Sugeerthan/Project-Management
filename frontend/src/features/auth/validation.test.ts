import { describe, expect, it } from "vitest";
import { hasVerifiedIdentity, safeNextPath } from "./routing";
import { validateLogin } from "./validation";

describe("login validation", () => {
  it("accepts existing passwords without imposing signup policy", () => {
    expect(validateLogin(" person@example.invalid ", "x")).toEqual({});
    expect(validateLogin("person@example.invalid", "  password with spaces  ")).toEqual({});
  });
  it.each(["", "person", "person@", "@example.invalid", "a b@example.invalid"])(
    "rejects invalid email %j",
    (email) => {
      expect(validateLogin(email, "test-password").email).toBeDefined();
    },
  );
  it("rejects empty and oversized input", () => {
    expect(validateLogin("person@example.invalid", "").password).toBeDefined();
    expect(validateLogin("person@example.invalid", "x".repeat(1025)).password).toBeDefined();
    expect(validateLogin(`${"a".repeat(254)}@example.invalid`, "x").email).toBeDefined();
  });
});

describe("redirect destinations and verified identities", () => {
  it.each([
    undefined,
    "/dashboard",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/login",
    "/dashboard?next=https://evil.example",
    "%2F%2Fevil.example",
    ["/dashboard"],
  ])("restricts next %j to the supported local dashboard", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
  it("requires a verified non-anonymous subject", () => {
    expect(hasVerifiedIdentity({ sub: "test-user", is_anonymous: false })).toBe(true);
    expect(hasVerifiedIdentity({ sub: "test-user", is_anonymous: true })).toBe(false);
    expect(hasVerifiedIdentity({ sub: "" })).toBe(false);
    expect(hasVerifiedIdentity(undefined)).toBe(false);
  });
});
