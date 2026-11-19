import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSignupService,
  signupService,
  type RegistrationAuthPort,
  type UsernameRegistryIntegration,
} from "./service";
import { USERNAME_CONTRACT_VERSION } from "./username";

const input = {
  email: " person@example.invalid ",
  password: "test password only",
  username: " Maya_7 ",
};
function setup() {
  const lookup = vi.fn().mockResolvedValue({ username: "maya_7", status: "available" });
  const registry: UsernameRegistryIntegration = {
    contractVersion: USERNAME_CONTRACT_VERSION,
    atomicRegistration: "auth-insert-trigger-v1",
    lookup,
  };
  const signUp = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: "synthetic-user" }, session: null }, error: null });
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const authFactory = vi.fn<() => RegistrationAuthPort>(() => ({ signUp, signOut }));
  return {
    service: createSignupService(registry, authFactory),
    registry,
    lookup,
    signUp,
    signOut,
    authFactory,
  };
}
afterEach(() => vi.useRealTimers());
describe("registration integration seam: mocked backend/SDK only", () => {
  it("ships unavailable with zero network, Auth, or DB mutations", async () => {
    const network = vi.spyOn(globalThis, "fetch");
    expect(signupService.registrationEnabled).toBe(false);
    expect(await signupService.checkUsername("maya_7", new AbortController().signal)).toEqual({
      username: "maya_7",
      status: "unavailable",
    });
    expect(await signupService.register(input)).toEqual({ status: "blocked" });
    const factory = vi.fn<() => RegistrationAuthPort>();
    expect(await createSignupService(null, factory).register(input)).toEqual({ status: "blocked" });
    expect(factory).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
  });
  it("checks local rules before looking up any name", async () => {
    const { service, lookup } = setup();
    expect((await service.checkUsername("ADMIN", new AbortController().signal)).status).toBe(
      "reserved",
    );
    expect((await service.checkUsername("invalid-name", new AbortController().signal)).status).toBe(
      "invalid",
    );
    expect(lookup).not.toHaveBeenCalled();
  });
  it("normalizes checks and rejects malformed, wrong-name and failed responses", async () => {
    const { service, lookup } = setup();
    expect((await service.checkUsername(" MAYA_7 ", new AbortController().signal)).status).toBe(
      "available",
    );
    expect(lookup.mock.calls[0][0]).toBe("maya_7");
    for (const result of [
      { username: "other_user", status: "available" },
      { username: "maya_7", status: "checking" },
      null,
    ]) {
      lookup.mockResolvedValue(result);
      expect((await service.checkUsername("maya_7", new AbortController().signal)).status).toBe(
        "unavailable",
      );
    }
    lookup.mockRejectedValue(new Error("Sensitive database detail"));
    expect(await service.checkUsername("maya_7", new AbortController().signal)).toEqual({
      username: "maya_7",
      status: "unavailable",
    });
  });
  it("does not perform registration for invalid fields or unavailable/taken names", async () => {
    const { service, signUp, lookup } = setup();
    expect((await service.register({ ...input, password: "short" })).status).toBe("invalid");
    for (const status of ["taken", "reserved", "unavailable"]) {
      lookup.mockResolvedValue({ username: "maya_7", status });
      expect((await service.register(input)).status).not.toBe("confirmation_required");
    }
    expect(signUp).not.toHaveBeenCalled();
  });
  it("uses signUp metadata for the proposed atomic trigger; never sends an ownership UUID", async () => {
    const { service, signUp, signOut } = setup();
    const forged = { ...input, owner_id: "attacker", user_id: "attacker" };
    expect(await service.register(forged)).toEqual({ status: "confirmation_required" });
    expect(signUp).toHaveBeenCalledWith({
      email: "person@example.invalid",
      password: input.password,
      options: {
        data: { requested_username: "maya_7", username_contract: USERNAME_CONTRACT_VERSION },
      },
    });
    expect(signOut).not.toHaveBeenCalled();
  });
  it("returns generic errors on a final uniqueness race instead of claiming reservation", async () => {
    const { service, signUp } = setup();
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "duplicate key private detail" },
    });
    expect(await service.register(input)).toEqual({ status: "error" });
  });
  it("does not claim an account was created from an obfuscated existing-email response", async () => {
    const { service, signUp } = setup();
    signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    expect(await service.register(input)).toEqual({ status: "confirmation_required" });
  });
  it("does not accept an automatically authenticated signup response", async () => {
    const { service, signUp, signOut } = setup();
    signUp.mockResolvedValue({
      data: { user: { id: "synthetic" }, session: { access_token: "synthetic" } },
      error: null,
    });
    expect(await service.register(input)).toEqual({ status: "unavailable" });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("handles network exceptions without exposing their contents", async () => {
    const { service, signUp } = setup();
    signUp.mockRejectedValue(new Error("Private response"));
    expect(await service.register(input)).toEqual({ status: "error" });
  });
  it("bounds even a lookup that ignores cancellation", async () => {
    vi.useFakeTimers();
    const { service, lookup, signUp } = setup();
    lookup.mockReturnValue(new Promise(() => {}));
    const pending = service.register(input);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ status: "unavailable" });
    expect(signUp).not.toHaveBeenCalled();
  });
  it("requires the matching integration contract", async () => {
    const { registry, authFactory } = setup();
    const incompatible = {
      ...registry,
      contractVersion: "future-incompatible",
    } as unknown as UsernameRegistryIntegration;
    expect(await createSignupService(incompatible, authFactory).register(input)).toEqual({
      status: "blocked",
    });
    expect(authFactory).not.toHaveBeenCalled();
  });
});
