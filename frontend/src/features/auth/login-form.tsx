"use client";

import { useRef, useState, type FormEvent } from "react";
import { createBrowserAuthClient } from "../../lib/supabase/browser";
import { replaceAuthLocation } from "./navigation";
import { safeNextPath } from "./routing";
import { validateLogin } from "./validation";

export function LoginForm({ configured, nextPath }: { configured: boolean; nextPath: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !configured) return;
    const validation = validateLogin(email, password);
    setErrors(validation);
    setMessage(null);
    if (Object.keys(validation).length) return;
    submitting.current = true;
    setPending(true);
    let navigating = false;
    try {
      const client = createBrowserAuthClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.session || !data.user || data.user.is_anonymous) {
        setMessage(
          "Unable to sign in. Check your email and password, and confirm your email if your account is new.",
        );
        return;
      }
      navigating = true;
      replaceAuthLocation(safeNextPath(nextPath));
    } catch {
      setMessage("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      if (!navigating) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300 disabled:opacity-60";
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Sign in"
      aria-busy={pending}
      className="space-y-6"
    >
      {!configured && (
        <p role="status" className="rounded-xl bg-slate-800 p-4 text-slate-200">
          Sign-in is temporarily unavailable. Please contact the Nexus team.
        </p>
      )}
      <div>
        <label htmlFor="email" className="font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending || !configured}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={inputClass}
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-2 text-sm text-rose-300">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="password" className="font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending || !configured}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          className={inputClass}
        />
        {errors.password && (
          <p id="password-error" role="alert" className="mt-2 text-sm text-rose-300">
            {errors.password}
          </p>
        )}
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-900 bg-rose-950 p-4 text-sm text-rose-200"
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || !configured}
        className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
