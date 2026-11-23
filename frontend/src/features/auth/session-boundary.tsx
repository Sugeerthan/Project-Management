"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createBrowserAuthClient } from "../../lib/supabase/browser";
import { replaceAuthLocation } from "./navigation";
import { DASHBOARD_PATH, hasVerifiedIdentity, LOGIN_PATH } from "./routing";

/** UI privacy for history restoration/cross-tab logout, not server authorization. */
export function SessionBoundary({ userId, children }: { userId: string; children: ReactNode }) {
  const [verified, setVerified] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    let client: ReturnType<typeof createBrowserAuthClient>;
    try {
      client = createBrowserAuthClient();
    } catch {
      replaceAuthLocation(LOGIN_PATH);
      return;
    }
    const hide = () => {
      generation++;
      if (content.current) content.current.hidden = true;
    };
    const deny = () => {
      generation++;
      hide();
      setVerified(false);
      replaceAuthLocation(LOGIN_PATH);
    };
    const check = async () => {
      const current = ++generation;
      try {
        const { data, error } = await client.auth.getClaims();
        if (!active || current !== generation) return;
        if (error || !hasVerifiedIdentity(data?.claims)) {
          deny();
          return;
        }
        if (data?.claims.sub !== userId) {
          hide();
          replaceAuthLocation(DASHBOARD_PATH);
          return;
        }
        setVerified(true);
        if (content.current) content.current.hidden = false;
      } catch {
        if (active && current === generation) deny();
      }
    };
    // Never await Supabase methods inside its auth-change callback (lock safety).
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") deny();
    });
    const restore = () => {
      hide();
      void check();
    };
    const focus = () => {
      hide();
      void check();
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", restore);
    window.addEventListener("focus", focus);
    void check();
    return () => {
      active = false;
      generation++;
      subscription.unsubscribe();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", restore);
      window.removeEventListener("focus", focus);
    };
  }, [userId]);
  return (
    <>
      {!verified && (
        <p role="status" className="text-slate-300">
          Checking your session…
        </p>
      )}
      <div ref={content} hidden={!verified}>
        {verified ? children : null}
      </div>
    </>
  );
}
