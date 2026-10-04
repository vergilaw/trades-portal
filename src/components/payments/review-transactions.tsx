import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/shared";
import { formatMoney } from "@/lib/quotes/format";
import { paymentDate } from "@/lib/payments/format";
import type { MessageKey } from "@/lib/i18n/messages";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
const reasons: Record<string, MessageKey> = {
  missing_reference: "Missing payment reference",
  multiple_references: "Multiple payment references",
  unknown_bank: "Unknown bank",
  unknown_reference: "Unknown payment reference",
  wrong_account: "Wrong receiving account",
  account_not_linked: "Receiving account is not linked",
  request_closed: "Payment request is closed",
  outside_validity: "Transfer outside request validity",
  amount_mismatch: "Amount does not match",
};
export async function ReviewTransactions({
  page,
  status,
  paymentPage,
}: {
  page: number;
  status: string;
  paymentPage: number;
}) {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const client = await createClient();
  const { data, count, error } = await client
    .from("sepay_transactions")
    .select("*", { count: "exact" })
    .eq("outcome", "review")
    .order("received_at", { ascending: false })
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
  const paymentIds = [
    ...new Set(
      (data ?? []).flatMap((row) => (row.payment_id ? [row.payment_id] : [])),
    ),
  ];
  const linked = paymentIds.length
    ? await client
        .from("payment_requests")
        .select("id,quote_id")
        .in("id", paymentIds)
    : { data: [] };
  const quotes = new Map(
    (linked.data ?? []).map((row) => [row.id, row.quote_id]),
  );
  const href = (next: number) =>
    `/payments?status=${status}&page=${paymentPage}&reviewPage=${next}#needs-review`;
  return (
    <section id="needs-review" className="mt-8 scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-950">
          {t("Needs review")}
          {count ? ` (${count})` : ""}
        </h2>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <p className="p-5 text-sm text-amber-800" role="alert">
            {t(
              "Payments are temporarily unavailable. Contact your administrator.",
            )}
          </p>
        ) : !data?.length ? (
          <div className="p-5">
            <h3 className="font-medium text-zinc-900">
              {t("No transactions need review")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {t("Unmatched incoming transfers appear here for manual review.")}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200">
            {data.map((row) => (
              <article key={row.id} className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-amber-800">
                    {t(reasons[row.reason] ?? "Needs review")}
                  </p>
                  <p className="font-semibold tabular-nums text-zinc-950">
                    {formatMoney(row.amount, "VND", locale)}
                  </p>
                </div>
                <p className="break-all text-sm text-zinc-600">
                  {row.gateway} · {row.account_number} ·{" "}
                  {paymentDate(row.transaction_at, locale)}
                </p>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-zinc-700">
                    {t("Review transaction")} #{row.provider_id}
                  </summary>
                  <dl className="space-y-3 rounded-lg bg-zinc-50 p-3 text-sm">
                    <div>
                      <dt className="text-zinc-500">{t("Transfer content")}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-all text-zinc-900">
                        {row.content}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">
                        {t("Bank reference or verification note")}
                      </dt>
                      <dd className="mt-1 break-all text-zinc-900">
                        {row.bank_reference || "—"}
                      </dd>
                    </div>
                  </dl>
                </details>
                {row.payment_id && quotes.get(row.payment_id) && (
                  <Link
                    href={`/quote/${quotes.get(row.payment_id)}`}
                    className={buttonStyles({
                      variant: "secondary",
                      size: "sm",
                    })}
                  >
                    {t("Open quote")}
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
      {!error && Boolean(count) && (
        <div className="mt-4 flex justify-end gap-2">
          {page > 1 && (
            <Link
              href={href(page - 1)}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              {t("Previous")}
            </Link>
          )}
          {page * 25 < (count ?? 0) && (
            <Link
              href={href(page + 1)}
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              {t("Next")}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
