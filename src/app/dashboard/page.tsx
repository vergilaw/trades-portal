import type { Metadata } from "next";
import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { CopyLinkButton } from "@/components/quotes/copy-link-button";
import { StatusBadge } from "@/components/quotes/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatMoney,
  formatQuoteDate,
  shortQuoteId,
} from "@/lib/quotes/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quotes",
};

type DashboardPageProps = {
  searchParams: Promise<{ created?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims) {
    redirect("/login");
  }

  const [{ data: quotes, error: quotesError }, params] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, public_token, customer_name, total, currency, status, created_at",
      )
      .order("created_at", { ascending: false }),
    searchParams,
  ]);
  const quoteRows = quotes ?? [];
  const createdQuote = params.created
    ? quoteRows.find((quote) => quote.public_token === params.created)
    : undefined;

  return (
    <AppShell email={authData.claims.email}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
            Quotes
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">
            Create quotes and track customer decisions.
          </p>
        </div>
        <Link href="/quote/new" className={buttonStyles({ className: "w-full sm:w-auto" })}>
          <Plus aria-hidden="true" size={17} weight="bold" />
          New quote
        </Link>
      </div>

      {createdQuote && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Quote created</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Copy the customer portal link and send it when you are ready.
            </p>
          </div>
          <div className="flex gap-2">
            <CopyLinkButton path={`/portal/${createdQuote.public_token}`} />
            <Link
              href={`/portal/${createdQuote.public_token}`}
              className={buttonStyles({ size: "sm" })}
            >
              View quote
            </Link>
          </div>
        </div>
      )}

      <Card className="mt-6 overflow-hidden border-t-4 border-t-brand-700">
        {quotesError ? (
          <div className="px-5 py-10 text-center">
            <h2 className="text-base font-semibold text-zinc-950">
              Quotes could not be loaded
            </h2>
            <p className="mt-1.5 text-sm text-zinc-600">
              Refresh the page to try again.
            </p>
          </div>
        ) : quoteRows.length === 0 ? (
          <EmptyState
            title="No quotes yet"
            description="Create your first quote and send your customer a link to review it."
            action={
              <Link href="/quote/new" className={buttonStyles()}>
                Create first quote
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_130px_130px_90px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-medium text-zinc-600 md:grid">
              <span>Customer</span>
              <span>Quote</span>
              <span>Date</span>
              <span className="text-right">Total</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-zinc-200">
              {quoteRows.map((quote) => (
                <article
                  key={quote.id}
                  className="px-4 py-4 transition-colors hover:bg-zinc-50 sm:px-5"
                >
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_130px_130px_90px] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/quote/${quote.id}`}
                        className="inline-flex max-w-full items-center gap-1.5 truncate font-semibold text-zinc-950 underline-offset-4 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        <span className="truncate">{quote.customer_name}</span>
                        <CaretRight
                          aria-hidden="true"
                          size={15}
                          className="shrink-0 text-zinc-400"
                        />
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 md:hidden">
                        <span className="font-mono">{shortQuoteId(quote.id)}</span>
                        <time dateTime={quote.created_at}>
                          {formatQuoteDate(quote.created_at)}
                        </time>
                      </div>
                    </div>

                    <span className="hidden font-mono text-xs text-zinc-600 md:block">
                      {shortQuoteId(quote.id)}
                    </span>
                    <time
                      dateTime={quote.created_at}
                      className="hidden text-sm text-zinc-600 md:block"
                    >
                      {formatQuoteDate(quote.created_at)}
                    </time>

                    <div className="flex items-center justify-between md:block md:text-right">
                      <span className="text-xs font-medium text-zinc-600 md:hidden">
                        Total
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-zinc-950">
                        {formatMoney(quote.total, quote.currency)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between md:justify-end">
                      <span className="text-xs font-medium text-zinc-600 md:hidden">
                        Status
                      </span>
                      <StatusBadge status={quote.status} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
