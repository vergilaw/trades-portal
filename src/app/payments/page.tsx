import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { bankName } from "@/lib/payments/banks";
import { paymentLabel } from "@/lib/payments/types";
import { paymentDate } from "@/lib/payments/format";
import { formatMoney, shortQuoteId } from "@/lib/quotes/format";
import { createClient } from "@/lib/supabase/server";
import { ReviewTransactions } from "@/components/payments/review-transactions";
import { RefreshPayment } from "@/components/payments/refresh-payment";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: translate("Payments", await getLocale()) };
}
const filters = [
  ["all", "All"],
  ["pending", "Awaiting transfer"],
  ["reported", "Awaiting confirmation"],
  ["paid", "Received"],
  ["expired", "Expired"],
  ["cancelled", "Cancelled"],
] as const;

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    page?: string;
    reviewPage?: string;
  }>;
}) {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const text = (key: string) => translate(key, locale);

  const query = await searchParams;
  const status =
    filters.find(([value]) => value === query.status)?.[0] ?? "all";
  const pageNumber = Number(query.page ?? "1");
  const page =
    Number.isSafeInteger(pageNumber) && pageNumber > 0
      ? Math.min(pageNumber, 100000)
      : 1;
  const reviewNumber = Number(query.reviewPage ?? "1");
  const reviewPage =
    Number.isSafeInteger(reviewNumber) && reviewNumber > 0
      ? Math.min(reviewNumber, 100000)
      : 1;
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getClaims();
  if (authError || !auth?.claims.sub) redirect("/login");
  let request = client
    .from("payment_requests")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");
  const now = new Date().toISOString();
  if (status === "expired")
    request = request.eq("status", "pending").lte("expires_at", now);
  else if (status === "pending")
    request = request.eq("status", "pending").gt("expires_at", now);
  else if (status !== "all") request = request.eq("status", status);
  const {
    data: payments,
    error,
    count,
  } = await request.range((page - 1) * 25, page * 25 - 1);
  return (
    <AppShell email={auth.claims.email}>
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline underline-offset-4"
        >
          {t("Back to quotes")}
        </Link>
        <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
              {t("Payments")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {t(
                "Track transfers, confirm receipts and review SePay reconciliation.",
              )}
            </p>
          </div>
          <Link
            href="/settings"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            {t("Receiving accounts")}
          </Link>
        </div>
        <div className="mb-5">
          <RefreshPayment
            auto={Boolean(
              payments?.some(
                (p) =>
                  p.status === "reported" ||
                  (p.status === "pending" && p.expires_at > now),
              ),
            )}
          />
        </div>
        <nav
          aria-label={t("Filter payments")}
          className="mb-5 flex flex-wrap gap-2"
        >
          {filters.map(([value, label]) => (
            <Link
              key={value}
              href={`/payments?status=${value}`}
              aria-current={status === value ? "page" : undefined}
              className={buttonStyles({
                variant: status === value ? "primary" : "secondary",
                size: "sm",
              })}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
        <Card className="overflow-hidden">
          {error ? (
            <p role="alert" className="p-5 text-sm text-amber-800">
              {t(
                "Payments are temporarily unavailable. Contact your administrator.",
              )}
            </p>
          ) : !payments?.length ? (
            <div className="p-6">
              <h2 className="font-semibold text-zinc-950">
                {t("No payment requests here")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {t("Open an approved quote to create a payment request.")}
              </p>
              <Link
                href="/dashboard"
                className={buttonStyles({
                  className: "mt-4",
                  variant: "secondary",
                })}
              >
                {t("View quotes")}
              </Link>
            </div>
          ) : (
            <>
              <div className="divide-y divide-zinc-200">
                {payments.map((payment) => (
                  <Link
                    key={payment.id}
                    href={`/quote/${payment.quote_id}`}
                    className="block px-4 py-5 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700 sm:px-6"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold text-zinc-950">
                        {text(paymentLabel(payment))}
                      </span>
                      <span className="font-semibold tabular-nums text-zinc-950">
                        {formatMoney(payment.amount, payment.currency, locale)}
                      </span>
                    </div>
                    {payment.status === "paid" && (
                      <p className="mt-2 text-sm text-brand-700">
                        {payment.settlement_source === "sepay"
                          ? t("Confirmed by SePay")
                          : t("Confirmed manually")}
                      </p>
                    )}
                    <p className="mt-2 break-all text-sm text-zinc-700">
                      {payment.reference}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {t("Quote")} {shortQuoteId(payment.quote_id)} ·{" "}
                      {bankName(payment.bank_bin)} · {payment.account_number}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Created")} {paymentDate(payment.created_at, locale)}{" "}
                      {t("(Vietnam time)")}
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Card>
        {!error && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600">
            <p>
              {t("{count} requests · Page {page}", { count: count ?? 0, page })}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/payments?status=${status}&page=${page - 1}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  {t("Previous")}
                </Link>
              )}
              {page * 25 < (count ?? 0) && (
                <Link
                  href={`/payments?status=${status}&page=${page + 1}`}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  {t("Next")}
                </Link>
              )}
            </div>
          </div>
        )}
        <ReviewTransactions
          page={reviewPage}
          status={status}
          paymentPage={page}
        />
      </div>
    </AppShell>
  );
}
