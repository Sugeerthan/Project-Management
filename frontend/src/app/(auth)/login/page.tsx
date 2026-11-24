import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "../../../features/auth/login-form";
import { safeNextPath } from "../../../features/auth/routing";
import { getAuthenticatedUser } from "../../../features/auth/server";
import { getSupabasePublicConfig } from "../../../lib/supabase/config";

export const metadata: Metadata = {
  title: "Sign in | Nexus",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  await connection();
  const nextPath = safeNextPath((await searchParams).next);
  if (await getAuthenticatedUser()) redirect(nextPath);
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:py-20">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="text-lg font-semibold tracking-wide text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          Nexus Solutions
        </Link>
        <section
          className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl sm:p-8"
          aria-labelledby="login-title"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-cyan-300">
            Your next chapter
          </p>
          <h1 id="login-title" className="mt-3 text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mb-8 mt-3 leading-7 text-slate-300">Sign in to your Nexus account.</p>
          <LoginForm configured={!!getSupabasePublicConfig()} nextPath={nextPath} />
        </section>
        <p className="mt-6 text-sm leading-6 text-slate-400">
          Use your verified account email. New accounts must confirm their email before signing in.
        </p>
      </div>
    </main>
  );
}
