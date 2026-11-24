"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { signupService, type SignupService } from "./service";
import { suggestUsernames } from "./username";
import { useUsernameAvailability } from "./use-username-availability";
import { validateSignup, type SignupErrors } from "./validation";

const availabilityMessages = {
  idle: "Choose a username to check.",
  checking: "Checking username…",
  available:
    "This username is currently available. It is not reserved until registration completes.",
  taken: "This username is taken. Try another name.",
  reserved: "This username is reserved. Choose another name.",
  invalid: "Use 3–30 letters, numbers or underscores, starting with a letter.",
  unavailable: "We can't check usernames right now. Availability has not been confirmed.",
};

/** Service injection is used only by unit tests; the real page always uses the blocked service. */
export function SignupForm({ service = signupService }: { service?: SignupService }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const submitting = useRef(false);
  const { availability, recheck } = useUsernameAvailability(username, service);
  const suggestions = ["taken", "reserved"].includes(availability.status)
    ? suggestUsernames(username)
    : [];
  const locked = pending || confirmation;
  const usernameInvalid = ["invalid", "reserved", "taken"].includes(availability.status);
  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300 disabled:opacity-60";

  function blur(field: keyof SignupErrors) {
    setErrors((current) => ({
      ...current,
      [field]: validateSignup({ email, password, username })[field],
    }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || confirmation) return;
    const validation = validateSignup({ email, password, username });
    setErrors(validation);
    setMessage(null);
    if (Object.keys(validation).length) return;
    if (!service.registrationEnabled) {
      setMessage(
        "Signup is not available yet. Username registration is being set up. Please try again later.",
      );
      return;
    }
    if (availability.status !== "available") {
      setMessage("Confirm username availability before creating your account.");
      return;
    }
    submitting.current = true;
    setPending(true);
    try {
      const result = await service.register({ email, password, username: availability.username });
      if (result.status === "confirmation_required") {
        setPassword("");
        setConfirmation(true);
      } else {
        setMessage(
          result.status === "blocked" || result.status === "unavailable"
            ? "Signup is temporarily unavailable. Please try again later."
            : "We couldn't complete registration. Check your details and username, or try signing in if you already have an account.",
        );
        recheck();
      }
    } catch {
      setMessage("We couldn't complete registration. Please try again later.");
      recheck();
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={submit}
      noValidate
      aria-label="Create an account"
      aria-busy={pending}
      className="space-y-6"
    >
      {!service.registrationEnabled && (
        <p
          role="status"
          className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-sm leading-6 text-slate-200"
        >
          Signup is not available yet. Username registration is being set up. You can sign in if you
          already have an account.
        </p>
      )}
      {confirmation && (
        <p
          role="status"
          className="rounded-xl border border-cyan-700 bg-cyan-950 p-4 leading-7 text-cyan-100"
        >
          If registration can be completed, check your email for a confirmation link. After
          confirming your email, return to sign in.
        </p>
      )}
      <div>
        <label htmlFor="signup-email" className="font-medium">
          Email address
        </label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => blur("email")}
          disabled={locked}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "signup-email-error" : undefined}
          className={inputClass}
        />
        {errors.email && (
          <p id="signup-email-error" role="alert" className="mt-2 text-sm text-rose-300">
            {errors.email}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="signup-password" className="font-medium">
          Password
        </label>
        <div className="flex items-start gap-2">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={() => blur("password")}
            disabled={locked}
            aria-invalid={!!errors.password}
            aria-describedby={`password-help${errors.password ? " signup-password-error" : ""}`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-controls="signup-password"
            aria-pressed={showPassword}
            disabled={locked}
            className="mt-2 rounded-xl border border-slate-600 px-3 py-3 text-sm font-medium text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-60"
          >
            {showPassword ? "Hide password" : "Show password"}
          </button>
        </div>
        <p id="password-help" className="mt-2 text-sm text-slate-400">
          At least 12 characters; no more than 72 UTF-8 bytes.
        </p>
        {errors.password && (
          <p id="signup-password-error" role="alert" className="mt-2 text-sm text-rose-300">
            {errors.password}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="signup-username" className="font-medium">
          Username
        </label>
        <input
          id="signup-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          required
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setErrors((value) => ({ ...value, username: undefined }));
            setMessage(null);
          }}
          onBlur={() => blur("username")}
          disabled={locked}
          aria-invalid={!!errors.username || usernameInvalid}
          aria-describedby={`username-rules username-status${errors.username ? " signup-username-error" : ""}`}
          className={inputClass}
        />
        <p id="username-rules" className="mt-2 text-sm leading-6 text-slate-400">
          3–30 lowercase letters, numbers or underscores. Start with a letter. Uppercase letters are
          normalized.
        </p>
        <p
          id="username-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`mt-2 text-sm leading-6 ${usernameInvalid ? "text-rose-300" : "text-slate-300"}`}
        >
          {availabilityMessages[availability.status]}
        </p>
        {errors.username && (
          <p id="signup-username-error" role="alert" className="mt-2 text-sm text-rose-300">
            {errors.username}
          </p>
        )}
        {availability.status === "unavailable" && (
          <button
            type="button"
            onClick={recheck}
            disabled={locked}
            className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            Check again
          </button>
        )}
        {suggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-slate-300">
              Try one of these names. Their availability has not been checked.
            </p>
            <ul aria-label="Username suggestions" className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setUsername(suggestion);
                      setErrors((value) => ({ ...value, username: undefined }));
                      setMessage(null);
                    }}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-cyan-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-900 bg-rose-950 p-4 text-sm leading-6 text-rose-200"
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={locked || !service.registrationEnabled || availability.status !== "available"}
        className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-300">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-cyan-200 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
