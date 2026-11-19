import { validateLogin } from "../auth/validation";
import { validateUsername } from "./username";

export type SignupInput = { email: string; password: string; username: string };
export type SignupErrors = { email?: string; password?: string; username?: string };

export function validateSignup(input: SignupInput): SignupErrors {
  const errors: SignupErrors = {};
  const loginErrors = validateLogin(input.email, input.password);
  if (loginErrors.email) errors.email = loginErrors.email;
  // Proposed client baseline; must be reconciled with the approved Auth policy.
  // Do not trim passwords or silently truncate their UTF-8 bytes.
  if (
    !input.password.trim() ||
    [...input.password].length < 12 ||
    new TextEncoder().encode(input.password).byteLength > 72
  ) {
    errors.password = "Use at least 12 characters and no more than 72 UTF-8 bytes.";
  }
  const username = validateUsername(input.username);
  if (username.status === "idle" || username.status === "invalid") {
    errors.username = "Use 3–30 letters, numbers or underscores, starting with a letter.";
  } else if (username.status === "reserved")
    errors.username = "This username is reserved. Choose another name.";
  return errors;
}
