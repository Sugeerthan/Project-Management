"use client";

import { useRef, useState } from "react";
import { createBrowserAuthClient } from "../../lib/supabase/browser";
import { replaceAuthLocation } from "./navigation";
import { LOGIN_PATH } from "./routing";

export function LogoutButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const { error } = await createBrowserAuthClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      replaceAuthLocation(LOGIN_PATH);
    } catch {
      setError("We couldn't sign you out. Please try again.");
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={logout}
        disabled={pending}
        className="rounded-xl border border-slate-600 px-5 py-3 font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Logout"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
