export const DASHBOARD_PATH = "/dashboard" as const;
export const LOGIN_PATH = "/login" as const;

/** Only implemented, local destinations are permitted; no URL parsing ambiguity. */
export function safeNextPath(value: unknown): typeof DASHBOARD_PATH {
  return value === DASHBOARD_PATH ? value : DASHBOARD_PATH;
}

export function hasVerifiedIdentity(claims: Record<string, unknown> | undefined): boolean {
  return typeof claims?.sub === "string" && claims.sub.length > 0 && claims.is_anonymous !== true;
}
