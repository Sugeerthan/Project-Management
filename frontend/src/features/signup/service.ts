import { createRegistrationAuthClient } from "../../lib/supabase/registration";
import { USERNAME_CONTRACT_VERSION, validateUsername } from "./username";
import { validateSignup, type SignupInput } from "./validation";

export type UsernameLookupStatus = "available" | "taken" | "reserved" | "invalid" | "unavailable";
export type UsernameLookupResult = { username: string; status: UsernameLookupStatus };
export type SignupResult =
  | { status: "confirmation_required" }
  | { status: "blocked" | "unavailable" | "invalid" | "username_unavailable" | "error" };

/** A semantic integration contract, not an implemented endpoint or migration. */
export interface UsernameRegistryIntegration {
  readonly contractVersion: typeof USERNAME_CONTRACT_VERSION;
  readonly atomicRegistration: "auth-insert-trigger-v1";
  lookup(username: string, signal: AbortSignal): Promise<UsernameLookupResult>;
}

export interface SignupService {
  readonly registrationEnabled: boolean;
  checkUsername(username: string, signal: AbortSignal): Promise<UsernameLookupResult>;
  register(input: SignupInput): Promise<SignupResult>;
}

export interface RegistrationAuthPort {
  signUp(input: {
    email: string;
    password: string;
    options: {
      data: { requested_username: string; username_contract: typeof USERNAME_CONTRACT_VERSION };
    };
  }): Promise<{ data: { user: unknown; session: unknown }; error: unknown }>;
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
}

/**
 * Integration seam for the future reviewed DB/trigger rollout and mocked tests.
 * A TypeScript marker is NOT evidence a database is ready. Do not wire a real
 * integration until the documented migrations, atomicity and RLS tests pass.
 */
export function createSignupService(
  registry: UsernameRegistryIntegration | null,
  authFactory: () => RegistrationAuthPort = () => createRegistrationAuthClient().auth,
): SignupService {
  const ready =
    registry?.contractVersion === USERNAME_CONTRACT_VERSION &&
    registry.atomicRegistration === "auth-insert-trigger-v1";
  const checkUsername = async (raw: string, signal: AbortSignal): Promise<UsernameLookupResult> => {
    const { username, status } = validateUsername(raw);
    if (status !== "valid")
      return { username, status: status === "reserved" ? "reserved" : "invalid" };
    if (!ready || !registry || signal.aborted) return { username, status: "unavailable" };
    try {
      const result = await registry.lookup(username, signal);
      // Never accept an answer for another name, or invent availability on failure.
      if (
        signal.aborted ||
        result.username !== username ||
        !["available", "taken", "reserved", "invalid", "unavailable"].includes(result.status)
      ) {
        return { username, status: "unavailable" };
      }
      return { username, status: result.status };
    } catch {
      return { username, status: "unavailable" };
    }
  };
  return {
    registrationEnabled: !!ready,
    checkUsername,
    async register(input) {
      // Hard gate precedes client creation or any Auth request, even if a caller
      // bypasses the disabled form button or supplies a forged owner/ready flag.
      if (!ready) return { status: "blocked" };
      if (Object.keys(validateSignup(input)).length) return { status: "invalid" };
      const username = validateUsername(input.username).username;
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const checked = await Promise.race([
          checkUsername(username, controller.signal),
          new Promise<UsernameLookupResult>((resolve) => {
            timeout = setTimeout(() => {
              controller.abort();
              resolve({ username, status: "unavailable" });
            }, 8000);
          }),
        ]);
        clearTimeout(timeout);
        if (checked.status === "unavailable") return { status: "unavailable" };
        if (checked.status !== "available") return { status: "username_unavailable" };
        // The future Auth insert trigger owns the actual atomic reservation.
        // No client-side INSERT/UPDATE follows signUp, and no owner UUID is sent.
        const auth = authFactory();
        const { data, error } = await auth.signUp({
          email: input.email.trim(),
          password: input.password,
          options: {
            data: { requested_username: username, username_contract: USERNAME_CONTRACT_VERSION },
          },
        });
        if (error || !data.user) return { status: "error" };
        if (data.session) {
          // Confirmation setting drift must not log the user in. This isolated
          // client has no cookie/localStorage persistence, even if cleanup fails.
          await auth.signOut({ scope: "local" });
          return { status: "unavailable" };
        }
        // Supabase can obfuscate an existing-email result. Do not claim creation,
        // ownership or reservation success from a user object alone.
        return { status: "confirmation_required" };
      } catch {
        return { status: "error" };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

// Deliberately disconnected: no endpoint, database query, environment flag, or
// browser-supplied "ready" value can enable registration in this implementation.
export const signupService: SignupService = createSignupService(null);
