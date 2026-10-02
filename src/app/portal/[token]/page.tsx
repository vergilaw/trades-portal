import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";

import { PhotoGallery } from "@/components/quotes/photo-gallery";
import { ResponseActions } from "@/components/quotes/response-actions";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Brand } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
import {
  formatExpiryDate,
  formatMoney,
  shortQuoteId,
} from "@/lib/quotes/format";
import { parsePortalQuote } from "@/lib/quotes/portal";
import { createSignedPhotoViews } from "@/lib/quotes/signed-photos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer quote",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PortalPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ response?: string }>;
};

export default async function PortalPage({ params, searchParams }: PortalPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams]);

  if (!uuidPattern.test(token)) {
    notFound();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_quote", {
    p_token: token,
  });

  if (error || data === null) {
    notFound();
  }

  const quote = parsePortalQuote(data);

  if (!quote) {
    notFound();
  }

  const businessName =
    quote.contractor.businessName || quote.contractor.name || "Trades Portal";
  const photos = await createSignedPhotoViews(quote.photos);

  return (
    <main className="min-h-[100dvh] bg-[#f4f6f5] px-4 py-5 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Brand href={`/portal/${token}`} />
          <StatusBadge status={quote.status} />
        </div>

        <Card className="overflow-hidden border-t-4 border-t-brand-700">
          <header className="border-b border-zinc-200 px-5 py-6 sm:px-8 sm:py-8">
            <p className="text-sm font-semibold text-brand-700">{businessName}</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
                  {quote.title}
                </h1>
                <p className="mt-1 font-mono text-sm text-zinc-500">
                  {shortQuoteId(quote.id)}
                </p>
                {quote.expiresAt && (
                  <p className="mt-2 text-sm text-zinc-600">
                    Valid until {formatExpiryDate(quote.expiresAt)}
                  </p>
                )}
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-medium text-zinc-500">
                  Prepared for
                </p>
                <p className="mt-1 font-semibold text-zinc-950">
                  {quote.customerName}
                </p>
              </div>
            </div>
          </header>

          <section aria-labelledby="quote-items-heading">
            <h2 id="quote-items-heading" className="sr-only">
              Quote items
            </h2>

            <div className="hidden grid-cols-[minmax(0,1fr)_80px_130px_130px] gap-4 border-b border-zinc-200 bg-zinc-50 px-8 py-3 text-xs font-semibold text-zinc-600 sm:grid">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit price</span>
              <span className="text-right">Total</span>
            </div>

            <div className="divide-y divide-zinc-200">
              {quote.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_80px_130px_130px] sm:items-center sm:gap-4 sm:px-8"
                >
                  <p className="font-medium text-zinc-950">{item.description}</p>
                  <div className="flex justify-between text-sm text-zinc-600 sm:block sm:text-right">
                    <span className="sm:hidden">Qty</span>
                    <span className="tabular-nums">{item.quantity}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-600 sm:block sm:text-right">
                    <span className="sm:hidden">Unit price</span>
                    <span className="tabular-nums">
                      {formatMoney(item.unitPrice, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-zinc-950 sm:block sm:text-right">
                    <span className="sm:hidden">Total</span>
                    <span className="tabular-nums">
                      {formatMoney(item.quantity * item.unitPrice, quote.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-zinc-200 bg-zinc-50 px-5 py-5 sm:px-8">
            <div className="ml-auto max-w-sm space-y-2">
              <div className="flex justify-between text-sm text-zinc-600">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatMoney(quote.subtotal, quote.currency)}
                </span>
              </div>
              {quote.taxAmount > 0 && (
                <div className="flex justify-between text-sm text-zinc-600">
                  <span>Tax ({quote.taxRate}%)</span>
                  <span className="tabular-nums">
                    {formatMoney(quote.taxAmount, quote.currency)}
                  </span>
                </div>
              )}
              <div className="flex items-end justify-between border-t border-zinc-300 pt-3">
                <span className="font-semibold text-zinc-950">Total</span>
                <span className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 tabular-nums">
                  {formatMoney(quote.total, quote.currency)}
                </span>
              </div>
            </div>
          </section>

          {quote.notes && (
            <section className="border-t border-zinc-200 px-5 py-5 sm:px-8">
              <h2 className="text-sm font-semibold text-zinc-950">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                {quote.notes}
              </p>
            </section>
          )}

          {quote.photos.length > 0 && (
            <section
              aria-labelledby="job-photos-heading"
              className="border-t border-zinc-200 px-5 py-5 sm:px-8"
            >
              <div className="mb-4">
                <h2
                  id="job-photos-heading"
                  className="text-sm font-semibold text-zinc-950"
                >
                  Job photos
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Before and after evidence provided with this quote.
                </p>
              </div>
              {photos.length > 0 ? (
                <PhotoGallery photos={photos} />
              ) : (
                <p className="text-sm text-zinc-500">
                  Photos are temporarily unavailable. Refresh to try again.
                </p>
              )}
            </section>
          )}
        </Card>

        <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6">
          {query.response === "unavailable" && (
            <div role="alert" className="mb-4 rounded-lg bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              This quote has already been answered or is no longer available.
            </div>
          )}

          {quote.status === "sent" ? (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-zinc-950">
                  Ready to respond?
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  Review the details above, then approve or reject this quote.
                </p>
              </div>
              <ResponseActions token={token} />
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                {quote.status === "approved" ? (
                  <CheckCircle aria-hidden="true" size={28} weight="fill" />
                ) : (
                  <XCircle aria-hidden="true" size={28} weight="fill" />
                )}
              </div>
              <h2 className="mt-3 text-lg font-semibold text-zinc-950">
                {quote.status === "approved" ? "Quote approved" : "Quote rejected"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Your response has been recorded.
              </p>
            </div>
          )}
        </section>

        {quote.contractor.phone && (
          <p className="mt-5 text-center text-sm text-zinc-500">
            Questions? Contact {businessName} at{" "}
            <a
              href={`tel:${quote.contractor.phone}`}
              className="font-medium text-zinc-700 underline underline-offset-4"
            >
              {quote.contractor.phone}
            </a>
          </p>
        )}
      </div>
    </main>
  );
}
