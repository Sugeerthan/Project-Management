import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "../../../features/signup/signup-form";

export const metadata: Metadata = {
  title: "Create an account | Nexus",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  // Public, non-personalized shell. No Auth or database request is needed while
  // registration is gated. The real form uses only the disconnected service.
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="text-lg font-semibold tracking-wide text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          Nexus Solutions
        </Link>
        <section
          className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"
          aria-labelledby="signup-title"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-cyan-300">
            Your next chapter
          </p>
          <h1 id="signup-title" className="mt-3 text-3xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="mb-8 mt-3 leading-7 text-slate-300">
            Choose a username and keep your account secure.
          </p>
          <SignupForm />
        </section>
      </div>
    </main>
  );
}
