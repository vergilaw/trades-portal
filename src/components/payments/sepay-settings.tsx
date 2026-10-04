"use client";
import { useActionState, useState } from "react";
import { configureSePayAction } from "@/lib/payments/sepay-actions";
import type { BankAccount, SePayConnection } from "@/lib/payments/types";
import { bankName } from "@/lib/payments/banks";
import { paymentDate } from "@/lib/payments/format";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/auth/form-fields";

function CopyValue({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-zinc-700">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5">
          {value}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t("Copied") : t("Copy")}
        </Button>
      </div>
    </div>
  );
}
export function SePaySettings({
  accounts,
  connection,
  linkedIds,
  appUrl,
  unavailable,
  ready,
}: {
  accounts: BankAccount[];
  connection: SePayConnection | null;
  linkedIds: string[];
  appUrl: string;
  unavailable: boolean;
  ready: boolean;
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(configureSePayAction, {});
  const [dismissedSecret, setDismissedSecret] = useState<string | null>(null);
  const url = (id: string) => `${appUrl}/api/payments/sepay/${id}`;
  return (
    <section aria-labelledby="sepay-heading" className="space-y-5">
      <div>
        <h2 id="sepay-heading" className="text-lg font-semibold text-zinc-950">
          {t("SePay automatic reconciliation")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {t("Select the receiving accounts linked to your SePay account.")}
        </p>
      </div>
      {unavailable ? (
        <FormAlert tone="error">
          {t("SePay settings could not be loaded. Refresh to try again.")}
        </FormAlert>
      ) : !ready ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          {t("Automatic reconciliation is not configured on this server.")}
        </p>
      ) : (
        <>
          {connection && (
            <div className="rounded-lg border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-900">
                {connection.is_active
                  ? t("SePay connected")
                  : t("SePay disconnected")}
              </p>
              <p className="mt-1 text-zinc-600">
                {connection.last_received_at
                  ? `${t("Last webhook")}: ${paymentDate(connection.last_received_at, locale)}`
                  : t("Waiting for the first webhook")}
              </p>
            </div>
          )}
          {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
          {state.message && (
            <FormAlert tone="success">{state.message}</FormAlert>
          )}
          <form action={action}>
            <fieldset disabled={pending} className="space-y-4">
              <input type="hidden" name="intent" value="configure" />
              <div className="space-y-2">
                {accounts
                  .filter((a) => a.is_active)
                  .map((a) => (
                    <label
                      key={a.id}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="accountId"
                        value={a.id}
                        defaultChecked={linkedIds.includes(a.id)}
                        className="mt-0.5 size-4 shrink-0 accent-brand-700"
                      />
                      <span className="min-w-0 break-all">
                        <span className="font-medium">
                          {bankName(a.bank_bin)} · {a.account_number}
                        </span>
                        <span className="mt-1 block text-zinc-500">
                          {a.holder_name}
                        </span>
                      </span>
                    </label>
                  ))}
              </div>
              {connection && (
                <p className="text-sm leading-6 text-zinc-600">
                  {t(
                    "Replacing the key invalidates the old key. Update your SePay webhook afterwards.",
                  )}
                </p>
              )}
              <Button
                type="submit"
                disabled={!accounts.some((a) => a.is_active)}
                className="w-full sm:w-auto"
              >
                {pending
                  ? t("Saving…")
                  : connection
                    ? t("Replace key and account selection")
                    : t("Connect SePay")}
              </Button>
            </fieldset>
          </form>
          {state.secret &&
          state.secret !== dismissedSecret &&
          state.connectionId ? (
            <div
              className="space-y-4 rounded-lg border border-brand-100 bg-brand-50 p-4"
              role="status"
            >
              <p className="text-sm font-semibold text-brand-800">
                {t("Save this key now. It will not be shown again.")}
              </p>
              <CopyValue
                value={url(state.connectionId)}
                label={t("Webhook URL")}
              />
              <CopyValue value={state.secret} label={t("Authentication key")} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDismissedSecret(state.secret ?? null)}
              >
                {t("Close key")}
              </Button>
            </div>
          ) : (
            connection && (
              <CopyValue value={url(connection.id)} label={t("Webhook URL")} />
            )
          )}
          <p className="text-sm leading-6 text-zinc-600">
            {t(
              "In SePay, create a Money in webhook for these accounts. Select JSON and HMAC-SHA256, then enter your webhook URL and key.",
            )}{" "}
            <a
              href="https://developer.sepay.vn/sepay-webhooks/tao-webhook"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center font-medium text-brand-700 underline underline-offset-4"
            >
              {t("SePay setup guide")}
            </a>
          </p>
          {connection?.is_active && (
            <form action={action}>
              <input type="hidden" name="intent" value="disconnect" />
              <Button type="submit" variant="secondary" disabled={pending}>
                {t("Disconnect SePay")}
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
