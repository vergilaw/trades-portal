import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import {
  ArrowLeft,
  ArrowSquareOut,
  PencilSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { OwnerPayment } from "@/components/payments/owner-payment";
import { CopyLinkButton } from "@/components/quotes/copy-link-button";
import { DuplicateQuoteButton } from "@/components/quotes/duplicate-quote-button";
import { PhotoManager } from "@/components/quotes/photo-manager";
import { StatusBadge } from "@/components/quotes/status-badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  formatMoney,
  formatExpiryDate,
  formatQuoteDate,
  isQuoteExpired,
  shortQuoteId,
} from "@/lib/quotes/format";
import { createSignedPhotoViews } from "@/lib/quotes/signed-photos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate("Quote details", await getLocale()) };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type QuoteDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    updated?: string;
    duplicated?: string;
    duplicate?: string;
    edit?: string;
  }>;
};

export default async function QuoteDetailsPage({
  params,
  searchParams,
}: QuoteDetailsPageProps) {
  const locale = await getLocale();
  const t = createTranslator(locale);

  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!uuidPattern.test(id)) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/login");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, public_token, title, customer_name, customer_email, customer_phone, currency, notes, status, subtotal, tax_rate, tax_amount, total, expires_at, created_at, quote_items(id, description, quantity, unit_price, position), quote_photos(id, phase, storage_path, width, height, position)",
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
          {t("Back to quotes")}{" "}
        </Link>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-500">
                {shortQuoteId(quote.id)}
              </span>
              <StatusBadge
                status={
                  quote.status === "sent" && isQuoteExpired(quote.expires_at)
                    ? "expired"
                    : quote.status
                }
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
              {quote.title}
            </h1>
            <p className="mt-1.5 text-sm text-zinc-600">
              {t("For")} {quote.customer_name} {t("· Created")}{" "}
              {formatQuoteDate(quote.created_at, locale)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quote.status === "sent" && (
              <Link
                href={`/quote/${quote.id}/edit`}
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                <PencilSimple aria-hidden="true" size={17} weight="bold" />
                {t("Edit")}{" "}
              </Link>
            )}
            <DuplicateQuoteButton quoteId={quote.id} />
            <CopyLinkButton path={`/portal/${quote.public_token}`} />
            <Link
              href={`/portal/${quote.public_token}`}
              target="_blank"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              <ArrowSquareOut aria-hidden="true" size={17} weight="bold" />
              {t("View portal")}{" "}
            </Link>
          </div>
        </div>

        {(query.updated === "1" || query.duplicated === "1") && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            {query.duplicated === "1"
              ? t("Quote duplicated. This copy has a new customer portal link.")
              : t("Quote changes saved.")}
          </div>
        )}
        {(query.duplicate === "error" || query.edit === "locked") && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          >
            {query.edit === "locked"
              ? t(
                  "Approved or rejected quotes cannot be edited. Duplicate this quote to make a new version.",
                )
              : t("The quote could not be duplicated. Try again.")}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5">
            <Card className="overflow-hidden border-t-4 border-t-brand-700">
              <div className="border-b border-zinc-200 px-4 py-4 sm:px-6">
                <h2 className="font-semibold text-zinc-950">
                  {t("Quote details")}
                </h2>
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
                      {formatMoney(item.unit_price, quote.currency, locale)}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-zinc-950 sm:text-right">
                      {formatMoney(
                        item.quantity * item.unit_price,
                        quote.currency,
                        locale,
                      )}
                    </p>
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-6">
                <div className="ml-auto max-w-xs space-y-2">
                  <div className="flex justify-between text-sm text-zinc-600">
                    <span>{t("Subtotal")}</span>
                    <span className="tabular-nums">
                      {formatMoney(quote.subtotal, quote.currency, locale)}
                    </span>
                  </div>
                  {quote.tax_amount > 0 && (
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>
                        {t("Tax (")}
                        {quote.tax_rate}%)
                      </span>
                      <span className="tabular-nums">
                        {formatMoney(quote.tax_amount, quote.currency, locale)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-end justify-between border-t border-zinc-300 pt-3">
                    <span className="font-semibold text-zinc-950">
                      {t("Total")}
                    </span>
                    <span className="text-xl font-semibold tabular-nums text-zinc-950">
                      {formatMoney(quote.total, quote.currency, locale)}
                    </span>
                  </div>
                </div>
              </div>
              {quote.notes && (
                <div className="border-t border-zinc-200 px-4 py-4 sm:px-6">
                  <h2 className="text-sm font-semibold text-zinc-950">
                    {t("Notes")}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                    {quote.notes}
                  </p>
                </div>
              )}
            </Card>

            <OwnerPayment
              quoteId={quote.id}
              status={quote.status}
              total={quote.total}
              currency={quote.currency}
            />

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
              <h2 className="font-semibold text-zinc-950">{t("Customer")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-zinc-500">{t("Name")}</dt>
                  <dd className="mt-0.5 font-medium text-zinc-900">
                    {quote.customer_name}
                  </dd>
                </div>
                {quote.customer_email && (
                  <div>
                    <dt className="text-zinc-500">{t("Email")}</dt>
                    <dd className="mt-0.5 break-all font-medium text-zinc-900">
                      {quote.customer_email}
                    </dd>
                  </div>
                )}
                {quote.customer_phone && (
                  <div>
                    <dt className="text-zinc-500">{t("Phone")}</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      <a
                        href={`tel:${quote.customer_phone}`}
                        className="inline-flex min-h-11 items-center underline-offset-4 hover:text-brand-800 hover:underline"
                      >
                        {quote.customer_phone}
                      </a>
                    </dd>
                  </div>
                )}
                {quote.expires_at && (
                  <div>
                    <dt className="text-zinc-500">{t("Valid until")}</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      {formatExpiryDate(quote.expires_at, locale)}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-5 border-t border-zinc-200 pt-4">
                <p className="text-xs leading-5 text-zinc-500">
                  {t(
                    "Customer portal links are private capabilities. Share them only with the intended customer.",
                  )}{" "}
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
