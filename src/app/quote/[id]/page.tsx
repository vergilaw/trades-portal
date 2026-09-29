import {
  ArrowLeft,
  ArrowSquareOut,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { CopyLinkButton } from "@/components/quotes/copy-link-button";
import { PhotoManager } from "@/components/quotes/photo-manager";
import { StatusBadge } from "@/components/quotes/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatMoney,
  formatQuoteDate,
  shortQuoteId,
} from "@/lib/quotes/format";
import { createSignedPhotoViews } from "@/lib/quotes/signed-photos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quote details",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuoteDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuoteDetailsPage({
  params,
}: QuoteDetailsPageProps) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/login");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, public_token, title, customer_name, customer_email, currency, notes, status, subtotal, tax_rate, tax_amount, total, created_at, quote_items(id, description, quantity, unit_price, position), quote_photos(id, phase, storage_path, width, height, position)",
    )
    .eq("id", id)
    .single();

  if (error || !quote) notFound();

  const photos = await createSignedPhotoViews(
    quote.quote_photos.map((photo) => ({
      id: photo.id,
      phase: photo.phase,
      storagePath: photo.storage_path,
      width: photo.width,
      height: photo.height,
      position: photo.position,
    })),
  );
  const items = [...quote.quote_items].sort(
    (left, right) => left.position - right.position,
  );

  return (
    <AppShell email={authData.claims.email}>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ArrowLeft aria-hidden="true" weight="bold" />
          Back to quotes
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-500">
                {shortQuoteId(quote.id)}
              </span>
              <StatusBadge status={quote.status} />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
              {quote.customer_name}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600">
              Created {formatQuoteDate(quote.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <CopyLinkButton path={`/portal/${quote.public_token}`} />
            <Link
              href={`/portal/${quote.public_token}`}
              target="_blank"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <ArrowSquareOut aria-hidden="true" size={17} weight="bold" />
              View portal
            </Link>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <Card className="overflow-hidden border-t-4 border-t-brand-700">
              <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
                <h2 className="font-semibold text-zinc-950">Quote details</h2>
              </div>
              <div className="divide-y divide-zinc-200">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-1 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_90px_130px] sm:items-center sm:px-6"
                  >
                    <p className="font-medium text-zinc-900">
                      {item.description}
                    </p>
                    <p className="text-sm text-zinc-500 sm:text-right">
                      {item.quantity} ×{" "}
                      {formatMoney(item.unit_price, quote.currency)}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-950 sm:text-right">
                      {formatMoney(
                        item.quantity * item.unit_price,
                        quote.currency,
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-6">
                <div className="ml-auto flex max-w-xs items-end justify-between">
                  <span className="font-semibold text-zinc-950">Total</span>
                  <span className="text-xl font-semibold tabular-nums text-zinc-950">
                    {formatMoney(quote.total, quote.currency)}
                  </span>
                </div>
              </div>
              {quote.notes && (
                <div className="border-t border-zinc-200 px-4 py-4 sm:px-6">
                  <h2 className="text-sm font-semibold text-zinc-950">Notes</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {quote.notes}
                  </p>
                </div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <PhotoManager
                quoteId={quote.id}
                publicToken={quote.public_token}
                initialPhotos={photos}
              />
            </Card>
          </div>

          <aside>
            <Card className="p-4 sm:p-5">
              <h2 className="font-semibold text-zinc-950">Customer</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">Name</dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">
                    {quote.customer_name}
                  </dd>
                </div>
                {quote.customer_email && (
                  <div>
                    <dt className="text-zinc-500">Email</dt>
                    <dd className="mt-0.5 break-all font-medium text-zinc-900">
                      {quote.customer_email}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 border-t border-zinc-200 pt-4">
                <p className="text-xs leading-5 text-zinc-500">
                  Customer portal links are private capabilities. Share them only
                  with the intended customer.
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
