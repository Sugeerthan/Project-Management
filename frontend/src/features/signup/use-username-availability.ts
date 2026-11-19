"use client";

import { useEffect, useRef, useState } from "react";
import { signupService, type SignupService, type UsernameLookupResult } from "./service";
import { validateUsername } from "./username";

export type UsernameAvailability =
  { username: string; status: "idle" | "checking" } | UsernameLookupResult;
export const USERNAME_DEBOUNCE_MS = 400;
export const USERNAME_TIMEOUT_MS = 8000;

export function useUsernameAvailability(raw: string, service: SignupService = signupService) {
  const validated = validateUsername(raw);
  const inputKey = `${validated.status}:${validated.username}`;
  const [request, setRequest] = useState({ key: inputKey, revision: 0 });
  // Adjust tracked input before committing a changed render. In particular A ->
  // B -> A must not reuse an old "available" result for A. No effect-time reset
  // or query cache is used to authorize the current form.
  if (request.key !== inputKey) setRequest({ key: inputKey, revision: request.revision + 1 });
  const revision = request.revision;
  const [answer, setAnswer] = useState<{ result: UsernameLookupResult; revision: number } | null>(
    null,
  );
  const generation = useRef(0);
  const username = validated.username;
  const localStatus = validated.status;
  useEffect(() => {
    if (localStatus !== "valid") return;
    const current = ++generation.current;
    const controller = new AbortController();
    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const debounce = setTimeout(async () => {
      timeout = setTimeout(() => {
        disposed = true;
        controller.abort();
        if (generation.current === current)
          setAnswer({ result: { username, status: "unavailable" }, revision });
      }, USERNAME_TIMEOUT_MS);
      try {
        const result = await service.checkUsername(username, controller.signal);
        if (disposed || controller.signal.aborted || current !== generation.current) return;
        setAnswer({
          result: result.username === username ? result : { username, status: "unavailable" },
          revision,
        });
      } catch {
        if (!disposed && current === generation.current)
          setAnswer({ result: { username, status: "unavailable" }, revision });
      } finally {
        clearTimeout(timeout);
      }
    }, USERNAME_DEBOUNCE_MS);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(debounce);
      clearTimeout(timeout);
    };
  }, [username, localStatus, revision, service]);
  let availability: UsernameAvailability;
  if (localStatus !== "valid") availability = { username, status: localStatus };
  else if (answer?.result.username === username && answer.revision === revision)
    availability = answer.result;
  else availability = { username, status: "checking" };
  return {
    availability,
    recheck: () => setRequest((value) => ({ ...value, revision: value.revision + 1 })),
  };
}
