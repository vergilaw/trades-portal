import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import Link from "next/link";
import { PaymentActionForm } from "./action-form";
import { selectClass } from "./bank-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  createQuotePaymentAction,
  changePaymentAction,
} from "@/lib/payments/actions";
import { bankName } from "@/lib/payments/banks";
import { paymentLabel } from "@/lib/payments/types";
import { formatMoney } from "@/lib/quotes/format";
import { createClient } from "@/lib/supabase/server";
import { paymentDate } from "@/lib/payments/format";
import { RefreshPayment } from "./refresh-payment";

export async function OwnerPayment({
  quoteId,
  status,
  total,
  currency,
}: {
  quoteId: string;
  status: string;
  total: number;
  currency: string;
}) {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const text = (key: string) => translate(key, locale);

  const client = await createClient();
  const [requestsResult, accountsResult] = await Promise.all([
    client
      .from("payment_requests")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false }),
    client
      .from("bank_accounts")
      .select("*")
      .eq("is_active", true)
      .order("created_at"),
  ]);
  const requests = requestsResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const ids = requests.map((request) => request.id);
  const eventsResult = ids.length
    ? await client
        .from("payment_events")
        .select("*")
        .in("payment_id", ids)
        .order("created_at")
    : { data: [], error: null };
  const current = requests.find(
    (request) =>
      request.status !== "cancelled" && paymentLabel(request) !== "Expired",
  );
  const eligible =
    status === "approved" &&
    currency === "VND" &&
    Number.isSafeInteger(total) &&
    total > 0;
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">
          {t("Bank transfer payment")}
        </h2>
        <Link
          href="/payments"
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-700 underline underline-offset-4"
        >
          {t("All payments")}
        </Link>
      </div>
      <p className="mt-1 text-sm leading-6 text-zinc-600">
        {t(
          "Issue a QR request. SePay can reconcile it automatically, or you can confirm receipt after checking your bank statement.",
        )}
      </p>
      <div className="mt-3">
        <RefreshPayment
          key={current?.id ?? "no-payment"}
          auto={Boolean(
            current && ["pending", "reported"].includes(current.status),
          )}
        />
      </div>
      {requestsResult.error || accountsResult.error ? (
        <p role="alert" className="mt-4 text-sm text-amber-800">
          {t(
            "Payments are temporarily unavailable. Contact your administrator.",
          )}
        </p>
      ) : (
        <>
          {!current &&
            eligible &&
            (accounts.length ? (
              <PaymentActionForm
                action={createQuotePaymentAction.bind(null, quoteId)}
                className="mt-5 space-y-3"
              >
                <label className="block text-sm font-medium text-zinc-800">
                  {t("Receiving account")}
                  <select
                    name="accountId"
                    required
                    className={selectClass}
                    defaultValue={accounts[0].id}
                  >
                    {accounts.map((account) => (
                      <option value={account.id} key={account.id}>
                        {bankName(account.bank_bin)} · {account.account_number}{" "}
                        · {account.holder_name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-zinc-500">
                  {t("Full payment of")} {formatMoney(total, currency, locale)}
                  {t(". QR request valid for 7 days.")}
                </p>
                <Button type="submit">{t("Create payment QR")}</Button>
              </PaymentActionForm>
            ) : (
              <p className="mt-4 text-sm text-zinc-600">
                <Link
                  href="/settings"
                  className="inline-flex min-h-11 items-center font-medium text-brand-700 underline"
                >
                  {t("Add a receiving account")}
                </Link>{" "}
                {t("before creating a payment request.")}
              </p>
            ))}
          {!eligible && requests.length === 0 && (
            <p className="mt-4 text-sm text-zinc-500">
              {t(
                "Available after approval for quotes with a positive whole VND total.",
              )}
            </p>
          )}
          <div className="mt-5 divide-y divide-zinc-200">
            {requests.map((payment) => (
              <div key={payment.id} className="space-y-4 py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-950">
                      {text(paymentLabel(payment))}
                    </p>
                    <p className="mt-1 break-all text-sm text-zinc-600">
                      {payment.reference}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-zinc-950">
                    {formatMoney(payment.amount, payment.currency, locale)}
                  </p>
                </div>
                {payment.status === "paid" && (
                  <p className="text-sm font-medium text-brand-700">
                    {payment.settlement_source === "sepay"
                      ? t("Confirmed by SePay")
                      : t("Confirmed manually")}
                  </p>
                )}
                <p className="text-sm leading-6 text-zinc-600">
                  {bankName(payment.bank_bin)} · {payment.account_number}
                  <br />
                  {payment.holder_name}
                  <br />
                  {t("Request expires")}{" "}
                  {paymentDate(payment.expires_at, locale)}{" "}
                  {t("(Vietnam time)")}
                </p>
                {payment.status === "reported" && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {t(
                      "The customer reported a transfer. Check your bank statement before confirming receipt.",
                    )}
                  </p>
                )}
                {(payment.status === "pending" ||
                  payment.status === "reported") && (
                  <PaymentActionForm
                    action={changePaymentAction.bind(null, quoteId, payment.id)}
                  >
                    <label className="block text-sm font-medium text-zinc-800">
                      {t("Bank reference or verification note")}
                      <Input
                        name="note"
                        maxLength={300}
                        className="mt-1.5"
                        placeholder={t(
                          "Bank transaction reference, amount and date checked",
                        )}
                      />
                    </label>
                    <label className="flex min-h-11 items-start gap-2 text-sm leading-6 text-zinc-600">
                      <input
                        type="checkbox"
                        name="verified"
                        className="mt-1.5 size-4 accent-brand-700"
                      />
                      {t(
                        "I checked my bank statement and received the full amount in this account.",
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="status" value="paid">
                        {t("Confirm receipt")}
                      </Button>
                      {payment.status === "reported" && (
                        <Button
                          type="submit"
                          variant="secondary"
                          name="status"
                          value="pending"
                        >
                          {t("Not received yet")}
                        </Button>
                      )}
                      <Button
                        type="submit"
                        variant="secondary"
                        name="status"
                        value="cancelled"
                      >
                        {t("Cancel request")}
                      </Button>
                    </div>
                  </PaymentActionForm>
                )}
                {eventsResult.error ? (
                  <p className="text-sm text-amber-800">
                    {t(
                      "Payment history could not be loaded. Refresh to try again.",
                    )}
                  </p>
                ) : (
                  <details className="text-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center font-medium text-zinc-700">
                      {t("Transaction history")}
                    </summary>
                    <ol className="mt-3 space-y-3 border-l-2 border-zinc-200 pl-4">
                      {(eventsResult.data ?? [])
                        .filter((event) => event.payment_id === payment.id)
                        .map((event) => (
                          <li key={event.id}>
                            <p className="text-zinc-800">
                              {event.from_status
                                ? `${text(paymentLabel({ status: event.from_status, expires_at: "9999-01-01" }))} → `
                                : t("Request created: ")}
                              {text(
                                paymentLabel({
                                  status: event.to_status,
                                  expires_at: "9999-01-01",
                                }),
                              )}{" "}
                              ·{" "}
                              {event.actor_kind === "system"
                                ? "SePay"
                                : event.actor_kind === "owner"
                                  ? t("Business")
                                  : t("Customer")}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {paymentDate(event.created_at, locale)}{" "}
                              {t("(Vietnam time)")}
                            </p>
                            {event.note && (
                              <p className="mt-1 whitespace-pre-wrap text-zinc-600">
                                {event.note === "Expired request replaced"
                                  ? t("Expired request replaced")
                                  : event.note}
                              </p>
                            )}
                          </li>
                        ))}
                    </ol>
                  </details>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
