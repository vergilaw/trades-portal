import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { AppShell } from "@/components/layout/app-shell";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create quote",
};

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  return (
    <AppShell email={data.claims.email}>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ArrowLeft aria-hidden="true" weight="bold" />
          Back to quotes
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
            Create quote
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">
            Add the customer and work details. You will get a portal link to share.
          </p>
        </div>

        <QuoteForm />
      </div>
    </AppShell>
  );
}
