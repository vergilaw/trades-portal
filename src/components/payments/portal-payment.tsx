import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import Image from "next/image";
import QRCode from "qrcode";
import { PaymentActionForm } from "./action-form";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportPaymentAction } from "@/lib/payments/actions";
import { bankName } from "@/lib/payments/banks";
import { parsePortalPayment } from "@/lib/payments/portal";
import { paymentLabel } from "@/lib/payments/types";
import { createVietQrPayload } from "@/lib/payments/vietqr";
import { formatMoney } from "@/lib/quotes/format";
import { createClient } from "@/lib/supabase/server";
import { paymentDate } from "@/lib/payments/format";
import { RefreshPayment } from "./refresh-payment";

export async function PortalPayment({ token }: { token: string }) {
  const locale = await getLocale();
  const t = createTranslator(locale);
  const text = (key: string) => translate(key, locale);

  const client = await createClient();
  const { data, error } = await client.rpc("get_portal_payment", {
    p_token: token,
  });
  const payment = data ? parsePortalPayment(data) : null;
  if (error || (data && !payment))
    return (
      <Card className="mt-5 p-5">
        <h2 className="text-lg font-semibold">{t("Bank transfer")}</h2>
        <p role="alert" className="mt-2 text-sm text-amber-800">
          {t(
            "Payment details are temporarily unavailable. Refresh or contact the business.",
          )}
        </p>
      </Card>
    );
  if (!payment)
    return (
      <Card className="mt-5 space-y-3 p-5">
        <h2 className="text-lg font-semibold">{t("Bank transfer")}</h2>
        <p className="text-sm text-zinc-600">
          {t("The business has not issued a payment request yet.")}
        </p>
        <RefreshPayment auto />
      </Card>
    );
  const label = paymentLabel(payment);
  const payable = label === "Awaiting transfer";
  let qr: string | null = null;
  if (payable) {
    try {
      qr = await QRCode.toDataURL(
        createVietQrPayload({
          bankBin: payment.bank_bin,
          accountNumber: payment.account_number,
          amount: payment.amount,
          reference: payment.reference,
        }),
        { errorCorrectionLevel: "M", margin: 4, width: 320 },
      );
    } catch {
      /* Keep transfer details available when local QR encoding fails. */
    }
  }
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-950">
            {t("Bank transfer")}
          </h2>
          <span role="status" className="text-sm font-semibold text-brand-700">
            {text(label)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {payment.status === "paid"
            ? t("The business confirmed receipt of your payment.")
            : payment.status === "reported"
              ? t(
                  "Your transfer is awaiting confirmation by the business. Do not send another payment.",
                )
              : payable
                ? t(
                    "Scan with your banking app. Check the recipient and amount before sending.",
                  )
                : t(
                    "This request is no longer available. Contact the business for a new payment request.",
                  )}
        </p>
        {payment.status === "paid" && (
          <p className="mt-2 text-sm font-medium text-brand-700">
            {payment.settlement_source === "sepay"
              ? t("Confirmed by SePay")
              : t("Confirmed manually")}
          </p>
        )}
        <div className="mt-3">
          <RefreshPayment
            key={payment.id}
            auto={payable || payment.status === "reported"}
          />
        </div>
      </div>
      <div className="grid gap-5 px-5 py-5 sm:px-6 sm:grid-cols-[240px_minmax(0,1fr)]">
        {qr ? (
          <div className="mx-auto w-full max-w-60">
            <Image
              src={qr}
              alt={t("Bank transfer QR for this payment request")}
              width={320}
              height={320}
              unoptimized
              className="h-auto w-full"
            />
            <a
              href={qr}
              download={`${payment.reference}.png`}
              className={buttonStyles({
                variant: "secondary",
                className: "mt-2 w-full",
              })}
            >
              {t("Save QR image")}
            </a>
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
            {payable
              ? t("QR unavailable. Use the exact transfer details shown here.")
              : text(label)}
          </div>
        )}
        <dl className="min-w-0 space-y-3 text-sm">
          {[
            [t("Amount"), formatMoney(payment.amount, "VND", locale)],
            [t("Receiving bank"), bankName(payment.bank_bin)],
            [t("Account number"), payment.account_number],
            [t("Account holder"), payment.holder_name],
            [t("Transfer content"), payment.reference],
          ].map(([title, detail]) => (
            <div key={title}>
              <dt className="text-zinc-500">{title}</dt>
              <dd className="mt-0.5 break-all select-all font-semibold text-zinc-950">
                {detail}
              </dd>
            </div>
          ))}
          {payable && (
            <div>
              <dt className="text-zinc-500">
                {t("Valid until (Vietnam time)")}
              </dt>
              <dd className="mt-0.5 text-zinc-800">
                {paymentDate(payment.expires_at, locale)}
              </dd>
            </div>
          )}
        </dl>
      </div>
      {payable && (
        <div className="border-t border-zinc-200 px-5 py-5 sm:px-6">
          <PaymentActionForm
            action={reportPaymentAction.bind(null, token, payment.id)}
          >
            <label className="flex items-start gap-2 text-sm leading-6 text-zinc-600">
              <input
                name="transferred"
                type="checkbox"
                required
                className="mt-1.5 size-4 accent-brand-700"
              />
              {t(
                "I have sent the full amount using the transfer content above.",
              )}
            </label>
            <Button type="submit">{t("I have transferred")}</Button>
            <p className="text-xs leading-5 text-zinc-500">
              {t(
                "This notifies the business. Payment is confirmed by SePay or after the business checks its bank statement.",
              )}
            </p>
          </PaymentActionForm>
        </div>
      )}
    </Card>
  );
}
