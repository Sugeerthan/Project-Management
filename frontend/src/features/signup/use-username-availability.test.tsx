// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUsernameAvailability } from "./use-username-availability";
import type { SignupService, UsernameLookupResult } from "./service";

const checkUsername = vi.fn<SignupService["checkUsername"]>();
const service: SignupService = { registrationEnabled: true, checkUsername, register: vi.fn() };
beforeEach(() => {
  vi.useFakeTimers();
  checkUsername.mockImplementation(async (username) => ({ username, status: "available" }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("debounced availability with mocked authoritative lookup", () => {
  it("starts idle, handles invalid/reserved locally, and debounces normalized names", async () => {
    const hook = renderHook(({ value }) => useUsernameAvailability(value, service), {
      initialProps: { value: "" },
    });
    expect(hook.result.current.availability.status).toBe("idle");
    hook.rerender({ value: "bad-name" });
    expect(hook.result.current.availability.status).toBe("invalid");
    hook.rerender({ value: "ADMIN" });
    expect(hook.result.current.availability.status).toBe("reserved");
    await advance(500);
    expect(checkUsername).not.toHaveBeenCalled();
    hook.rerender({ value: " MAYA_7 " });
    expect(hook.result.current.availability.status).toBe("checking");
    await advance(399);
    expect(checkUsername).not.toHaveBeenCalled();
    await advance(1);
    expect(checkUsername.mock.calls[0][0]).toBe("maya_7");
    expect(hook.result.current.availability.status).toBe("available");
  });
  it("cancels typing bursts before the debounce fires", async () => {
    const hook = renderHook(({ value }) => useUsernameAvailability(value, service), {
      initialProps: { value: "maya" },
    });
    await advance(200);
    hook.rerender({ value: "maya_1" });
    await advance(200);
    hook.rerender({ value: "maya_12" });
    await advance(400);
    expect(checkUsername).toHaveBeenCalledTimes(1);
    expect(checkUsername.mock.calls[0][0]).toBe("maya_12");
  });
  it("ignores a stale response even when the service ignores abort", async () => {
    let resolveOld!: (value: UsernameLookupResult) => void;
    checkUsername.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const hook = renderHook(({ value }) => useUsernameAvailability(value, service), {
      initialProps: { value: "first_user" },
    });
    await advance(400);
    const signal = checkUsername.mock.calls[0][1];
    hook.rerender({ value: "second_user" });
    expect(signal.aborted).toBe(true);
    await advance(400);
    expect(hook.result.current.availability.username).toBe("second_user");
    await act(async () => resolveOld({ username: "first_user", status: "taken" }));
    expect(hook.result.current.availability).toEqual({
      username: "second_user",
      status: "available",
    });
  });
  it("never reuses old availability after A -> B -> A", async () => {
    const hook = renderHook(({ value }) => useUsernameAvailability(value, service), {
      initialProps: { value: "maya" },
    });
    await advance(400);
    expect(hook.result.current.availability.status).toBe("available");
    hook.rerender({ value: "other_user" });
    hook.rerender({ value: "maya" });
    expect(hook.result.current.availability.status).toBe("checking");
    checkUsername.mockResolvedValue({ username: "maya", status: "taken" });
    await advance(400);
    expect(hook.result.current.availability.status).toBe("taken");
  });
  it("does not call failures or wrong-name results available; retry checks again", async () => {
    checkUsername.mockRejectedValueOnce(new Error("Private DB details"));
    const hook = renderHook(() => useUsernameAvailability("maya", service));
    await advance(400);
    expect(hook.result.current.availability.status).toBe("unavailable");
    checkUsername.mockResolvedValueOnce({ username: "wrong_user", status: "available" });
    act(() => hook.result.current.recheck());
    expect(hook.result.current.availability.status).toBe("checking");
    await advance(400);
    expect(hook.result.current.availability.status).toBe("unavailable");
  });
  it("times out and rejects a late success after timeout", async () => {
    let resolve!: (value: UsernameLookupResult) => void;
    checkUsername.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const hook = renderHook(() => useUsernameAvailability("maya", service));
    await advance(8400);
    expect(hook.result.current.availability.status).toBe("unavailable");
    await act(async () => resolve({ username: "maya", status: "available" }));
    expect(hook.result.current.availability.status).toBe("unavailable");
  });
  it("aborts and does not accept results after unmount", async () => {
    checkUsername.mockReturnValue(new Promise(() => {}));
    const hook = renderHook(() => useUsernameAvailability("maya", service));
    await advance(400);
    const signal = checkUsername.mock.calls[0][1];
    hook.unmount();
    expect(signal.aborted).toBe(true);
  });
});
