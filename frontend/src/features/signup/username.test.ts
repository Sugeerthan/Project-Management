import { describe, expect, it } from "vitest";
import {
  normalizeUsername,
  RESERVED_USERNAMES,
  suggestUsernames,
  validateUsername,
} from "./username";
import { validateSignup } from "./validation";

describe("proposed username contract", () => {
  it.each(["maya", "maya_7", "abc", "a".repeat(30), " Maya_7 "])("accepts %j", (name) => {
    expect(validateUsername(name).status).toBe("valid");
  });
  it.each([
    "ab",
    "a".repeat(31),
    "1maya",
    "_maya",
    "maya-name",
    "maya.name",
    "ma ya",
    "josé",
    "Kate",
    "ｍaya",
    "maya\nname",
    "<script>",
  ])("rejects %j", (name) => {
    expect(validateUsername(name).status).toBe("invalid");
  });
  it("normalizes ASCII case and surrounding whitespace but does not invent missing text", () => {
    expect(normalizeUsername(" \tMaYa_7\n")).toBe("maya_7");
    expect(validateUsername("  ").status).toBe("idle");
    expect(validateUsername("Ma Ya").status).toBe("invalid");
  });
  it("rejects every reserved name after canonicalization", () => {
    for (const reserved of RESERVED_USERNAMES)
      expect(validateUsername(` ${reserved.toUpperCase()} `).status).toBe("reserved");
  });
  it("produces deterministic bounded, valid, unique candidates without asserting availability", () => {
    expect(suggestUsernames("ADMIN")).toEqual(["admin_1", "admin_2", "admin_3"]);
    for (const name of ["admin", "maya", "a".repeat(30)]) {
      const candidates = suggestUsernames(name);
      expect(candidates).toHaveLength(3);
      expect(new Set(candidates).size).toBe(3);
      expect(candidates.every((value) => validateUsername(value).status === "valid")).toBe(true);
      expect(candidates).toEqual(suggestUsernames(name));
    }
    expect(suggestUsernames("bad-name")).toEqual([]);
  });
});

describe("signup field validation", () => {
  const input = {
    email: "person@example.invalid",
    password: "a secure password",
    username: "maya_7",
  };
  it("accepts valid fields and does not mutate the password", () => {
    expect(validateSignup(input)).toEqual({});
    expect(input.password).toBe("a secure password");
  });
  it.each(["", "invalid", "a b@example.invalid"])("rejects email %j", (email) => {
    expect(validateSignup({ ...input, email }).email).toBeDefined();
  });
  it.each(["", "short", " ".repeat(12), "a".repeat(73), "é".repeat(37)])(
    "rejects a weak/oversized password %#",
    (password) => {
      expect(validateSignup({ ...input, password }).password).toBeDefined();
    },
  );
  it("accepts exact password boundaries and preserves spaces", () => {
    for (const password of ["a".repeat(12), "a".repeat(72), "é".repeat(36), "  secure password  "])
      expect(validateSignup({ ...input, password }).password).toBeUndefined();
  });
  it("rejects missing/reserved usernames without treating display names as handles", () => {
    expect(validateSignup({ ...input, username: "" }).username).toBeDefined();
    expect(validateSignup({ ...input, username: "ADMIN" }).username).toContain("reserved");
    expect(validateSignup({ ...input, username: "Maya Example" }).username).toBeDefined();
  });
});
