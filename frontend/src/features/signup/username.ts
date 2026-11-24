/** Proposed account username policy; not an approved database/public-URL contract. */
export const USERNAME_CONTRACT_VERSION = "username-v1-proposed" as const;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "signup",
  "register",
  "dashboard",
  "settings",
  "portfolio",
  "portfolios",
  "auth",
  "support",
  "help",
  "www",
  "account",
  "accounts",
  "root",
  "system",
  "security",
  "static",
  "assets",
  "images",
  "favicon",
  "robots",
  "sitemap",
  "nexus",
  "onboarding",
  "review",
  "preview",
  "cv_upload",
  "theme_selection",
  "forgot_password",
  "customers",
  "themes",
  "processing",
]);

export type UsernameValidation = {
  username: string;
  status: "idle" | "valid" | "invalid" | "reserved";
};

export function normalizeUsername(value: string): string {
  // Lowercase ASCII only: Unicode case folding must not turn invalid source
  // characters (for example the Kelvin sign) into accepted ASCII usernames.
  return value.trim().replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function validateUsername(raw: string): UsernameValidation {
  const username = normalizeUsername(raw);
  if (!username) return { username, status: "idle" };
  if (username.length < 3 || username.length > 30 || !/^[a-z][a-z0-9_]*$/.test(username)) {
    return { username, status: "invalid" };
  }
  return { username, status: RESERVED_USERNAMES.has(username) ? "reserved" : "valid" };
}

/** Candidates only. No suggestion has been checked against a username registry. */
export function suggestUsernames(raw: string): string[] {
  const { username, status } = validateUsername(raw);
  if (status !== "valid" && status !== "reserved") return [];
  return [1, 2, 3]
    .map((suffix) => `${username.slice(0, 28)}_${suffix}`)
    .filter((candidate) => validateUsername(candidate).status === "valid");
}
