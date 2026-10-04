import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n/shared";
import { PaymentActionForm } from "./action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveBankAccountAction,
  toggleBankAccountAction,
} from "@/lib/payments/actions";
import { banks, bankName } from "@/lib/payments/banks";
import type { BankAccount } from "@/lib/payments/types";

export const selectClass =
  "mt-1.5 h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700";

export async function BankAccounts({
  accounts,
  unavailable,
}: {
  accounts: BankAccount[];
  unavailable: boolean;
}) {
  const locale = await getLocale();
  const t = createTranslator(locale);

  return (
    <section aria-labelledby="receiving-accounts-heading" className="space-y-5">
      <div>
        <h2
          id="receiving-accounts-heading"
          className="text-lg font-semibold text-zinc-950"
        >
          {t("Receiving bank accounts")}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {t(
            "Choose where customers send payment. Account details appear only on payment requests you issue.",
          )}
        </p>
      </div>
      {unavailable ? (
        <p role="alert" className="text-sm text-amber-800">
          {t(
            "Payment setup is temporarily unavailable. Contact your administrator.",
          )}
        </p>
      ) : (
        <>
          <div className="divide-y divide-zinc-200">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-zinc-950">
                    {bankName(account.bank_bin)}{" "}
                    <span className="font-normal text-zinc-500">
                      {account.is_active ? t("Active") : t("Disabled")}
                    </span>
                  </p>
                  <p className="mt-1 break-all text-zinc-800">
                    {account.account_number}
                  </p>
                  <p className="mt-1 text-zinc-500">{account.holder_name}</p>
                </div>
                <PaymentActionForm
                  action={toggleBankAccountAction.bind(
                    null,
                    account.id,
                    !account.is_active,
                  )}
                  className="sm:max-w-xs"
                >
                  <Button type="submit" variant="secondary" size="sm">
                    {account.is_active ? t("Disable") : t("Enable")}
                  </Button>
                </PaymentActionForm>
              </div>
            ))}
            {accounts.length === 0 && (
              <p className="py-2 text-sm text-zinc-500">
                {t("Add a receiving account to issue payment requests.")}
              </p>
            )}
          </div>
          <PaymentActionForm
            action={saveBankAccountAction}
            className="border-t border-zinc-200 pt-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="bankBin">{t("Receiving bank")}</Label>
                <select
                  id="bankBin"
                  name="bankBin"
                  required
                  defaultValue=""
                  className={selectClass}
                >
                  <option value="" disabled>
                    {t("Choose a bank")}
                  </option>
                  {banks.map((bank) => (
                    <option key={bank.bin} value={bank.bin}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="accountNumber">{t("Account number")}</Label>
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  required
                  maxLength={19}
                  pattern="[A-Za-z0-9]{1,19}"
                  autoComplete="off"
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="holderName">{t("Account holder name")}</Label>
                <Input
                  id="holderName"
                  name="holderName"
                  required
                  minLength={2}
                  maxLength={100}
                  className="mt-1.5"
                  placeholder="NGUYEN VAN AN"
                />
                <p className="mt-1.5 text-xs leading-5 text-zinc-500">
                  {t(
                    "Saved in uppercase without Vietnamese accents. Account ownership is not automatically verified.",
                  )}
                </p>
              </div>
            </div>
            <label className="flex min-h-11 items-start gap-2 text-sm leading-6 text-zinc-600">
              <input
                type="checkbox"
                name="verified"
                required
                className="mt-1.5 size-4 accent-brand-700"
              />
              {t(
                "I have checked the bank, account number and account holder name.",
              )}
            </label>
            <Button type="submit">{t("Save receiving account")}</Button>
            <p className="text-xs leading-5 text-zinc-500">
              {t(
                "Saving an existing account enables it again. Changes apply to new payment requests; existing requests keep their original details.",
              )}
            </p>
          </PaymentActionForm>
        </>
      )}
    </section>
  );
}
