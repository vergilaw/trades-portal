import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-950">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              T
            </span>
            <span className="font-semibold tracking-tight">Trades Portal</span>
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Trades Portal
            </h1>
            {data.claims.email && (
              <p className="mt-2 text-sm text-slate-600">Signed in as {data.claims.email}</p>
            )}
          </div>

          <Link
            href="/quote/new"
            className="flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            New Quote
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-950">Your quotes</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Create your first quote and share a secure portal link with your customer.
          </p>
        </section>
      </div>
    </main>
  );
}
