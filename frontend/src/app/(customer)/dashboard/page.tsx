import type { Metadata } from "next";
import { connection } from "next/server";
import { LogoutButton } from "../../../features/auth/logout-button";
import { SessionBoundary } from "../../../features/auth/session-boundary";
import { requireAuthenticatedUser } from "../../../features/auth/server";

export const metadata: Metadata = {
  title: "Dashboard | Nexus",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  await connection();
  // Independent server authorization even if proxy is bypassed or misconfigured.
  const user = await requireAuthenticatedUser();
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-lg font-semibold tracking-wide text-cyan-300">Nexus Solutions</p>
        <SessionBoundary userId={user.id}>
          <section
            className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-10"
            aria-labelledby="dashboard-title"
          >
            <p className="text-sm uppercase tracking-widest text-cyan-300">Your dashboard</p>
            <h1 id="dashboard-title" className="mt-3 text-3xl font-bold sm:text-4xl">
              Welcome to Nexus
            </h1>
            <p className="mt-5 break-words text-slate-300">
              Signed in as{" "}
              <span className="font-medium text-slate-100">
                {user.email ?? "your verified account"}
              </span>
            </p>
            <p className="mb-8 mt-3 leading-7 text-slate-400">
              Your account is ready. Portfolio creation is coming soon.
            </p>
            <LogoutButton />
          </section>
        </SessionBoundary>
      </div>
    </main>
  );
}
