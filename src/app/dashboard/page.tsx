import type { Metadata } from "next";
import {
  CaretRight,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { CopyLinkButton } from "@/components/quotes/copy-link-button";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  formatMoney,
  formatQuoteDate,
  isQuoteExpired,
  shortQuoteId,
  type QuoteDisplayStatus,
} from "@/lib/quotes/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quotes",
};

type DashboardPageProps = {
  searchParams: Promise<{ created?: string; status?: string; q?: string }>;
};

const filterOptions: Array<{ label: string; value?: QuoteDisplayStatus }> = [
  { label: "All" },
  { label: "Pending", value: "sent" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

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
        "id, public_token, title, customer_name, customer_email, total, currency, status, expires_at, created_at",
      )
      .order("created_at", { ascending: false }),
    searchParams,
  ]);
  const quoteRows = quotes ?? [];
  const createdQuote = params.created
    ? quoteRows.find((quote) => quote.public_token === params.created)
    : undefined;
  const activeStatus = filterOptions.find(
    (option) => option.value && option.value === params.status,
  )?.value;
  const searchTerm = params.q?.trim().slice(0, 80) ?? "";
  const normalizedSearch = searchTerm.toLocaleLowerCase("vi");
  const statusQuotes = activeStatus
    ? quoteRows.filter((quote) =>
        activeStatus === "expired"
          ? quote.status === "sent" && isQuoteExpired(quote.expires_at)
          : quote.status === activeStatus &&
            !(quote.status === "sent" && isQuoteExpired(quote.expires_at)),
      )
    : quoteRows;
  const visibleQuotes = normalizedSearch
    ? statusQuotes.filter((quote) =>
        [
          quote.title,
          quote.customer_name,
          quote.customer_email ?? "",
          quote.id,
        ]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalizedSearch),
      )
    : statusQuotes;
  const pendingCount = quoteRows.filter(
    (quote) => quote.status === "sent" && !isQuoteExpired(quote.expires_at),
  ).length;
  const approvedQuotes = quoteRows.filter(
    (quote) => quote.status === "approved",
  );
  const approvedValue = approvedQuotes.reduce(
    (total, quote) => total + quote.total,
    0,
  );
  const dashboardCurrency = quoteRows[0]?.currency ?? "VND";

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

      <section
        aria-label="Quote overview"
        className="mt-6 grid overflow-hidden rounded-xl border border-zinc-200 bg-white sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="border-b border-zinc-200 px-4 py-4 sm:border-r lg:border-b-0 sm:px-5">
          <p className="text-sm text-zinc-500">All quotes</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-zinc-950 tabular-nums">
            {quoteRows.length}
          </p>
        </div>
        <div className="border-b border-zinc-200 px-4 py-4 lg:border-b-0 lg:border-r sm:px-5">
          <p className="text-sm text-zinc-500">Awaiting response</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-amber-700 tabular-nums">
            {pendingCount}
          </p>
        </div>
        <div className="border-b border-zinc-200 px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
          <p className="text-sm text-zinc-500">Approved</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-emerald-700 tabular-nums">
            {approvedQuotes.length}
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="text-sm text-zinc-500">Approved value</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-zinc-950 tabular-nums">
            {formatMoney(approvedValue, dashboardCurrency)}
          </p>
        </div>
      </section>

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
            <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                <h2 className="font-semibold text-zinc-950">Quote register</h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {visibleQuotes.length} of {quoteRows.length} shown
                </p>
                </div>
                <form className="flex w-full gap-2 lg:max-w-md" role="search">
                  {activeStatus && (
                    <input type="hidden" name="status" value={activeStatus} />
                  )}
                  <div className="relative min-w-0 flex-1">
                    <MagnifyingGlass
                      aria-hidden="true"
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <Input
                      type="search"
                      name="q"
                      defaultValue={searchTerm}
                      maxLength={80}
                      aria-label="Search quotes"
                      placeholder="Search jobs or customers"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button type="submit" variant="secondary" size="sm">
                    Search
                  </Button>
                </form>
              </div>
              <nav
                aria-label="Filter quotes"
                className="mt-3 flex gap-1 overflow-x-auto border-t border-zinc-100 pt-3"
              >
                {filterOptions.map((option) => {
                  const isActive = option.value === activeStatus;
                  const hrefParams = new URLSearchParams();
                  if (option.value) hrefParams.set("status", option.value);
                  if (searchTerm) hrefParams.set("q", searchTerm);
                  const href = hrefParams.size
                    ? `/dashboard?${hrefParams.toString()}`
                    : "/dashboard";

                  return (
                    <Link
                      key={option.label}
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                      )}
                    >
                      {option.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {visibleQuotes.length === 0 ? (
              <EmptyState
                title={
                  searchTerm
                    ? `No quotes match “${searchTerm}”`
                    : `No ${activeStatus === "sent" ? "pending" : activeStatus} quotes`
                }
                description="Try another search or return to all quotes."
                action={
                  <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
                    Clear search and filters
                  </Link>
                }
              />
            ) : (
              <>
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_130px_130px_90px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-medium text-zinc-600 md:grid">
              <span>Job / customer</span>
              <span>Quote</span>
              <span>Date</span>
              <span className="text-right">Total</span>
              <span className="text-right">Status</span>
            </div>

            <div className="divide-y divide-zinc-200">
              {visibleQuotes.map((quote) => (
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
                        <span className="truncate">{quote.title}</span>
                        <CaretRight
                          aria-hidden="true"
                          size={15}
                          className="shrink-0 text-zinc-400"
                        />
                      </Link>
                      <p className="mt-0.5 truncate text-sm text-zinc-600">
                        {quote.customer_name}
                      </p>
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
                      <StatusBadge
                        status={
                          quote.status === "sent" && isQuoteExpired(quote.expires_at)
                            ? "expired"
                            : quote.status
                        }
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
              </>
            )}
          </>
        )}
      </Card>
    </AppShell>
  );
}
