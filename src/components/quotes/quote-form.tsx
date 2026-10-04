"use client";
import { useI18n } from "@/components/i18n/provider";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "@phosphor-icons/react";

import { FieldError, FormAlert } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuoteAction, updateQuoteAction } from "@/lib/quotes/actions";
import { formatMoney } from "@/lib/quotes/format";

type LineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const firstItem: LineItem = {
  id: "item-1",
  description: "",
  quantity: "1",
  unitPrice: "",
};

function numericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type QuoteFormInitialValue = {
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  taxRate: number;
  expiresAt: string | null;
  notes: string;
  items: LineItem[];
};

function SaveQuoteButton({ editing }: { editing: boolean }) {
  const { t } = useI18n();

  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending
        ? editing
          ? t("Saving changes...")
          : t("Creating quote...")
        : editing
          ? t("Save changes")
          : t("Create quote")}
    </Button>
  );
}

export function QuoteForm({
  quoteId,
  initialValue,
}: {
  quoteId?: string;
  initialValue?: QuoteFormInitialValue;
}) {
  const { t, locale } = useI18n();

  const action = quoteId
    ? updateQuoteAction.bind(null, quoteId)
    : createQuoteAction;
  const [state, formAction] = useActionState(action, {});
  const [fields, setFields] = useState({
    title: initialValue?.title ?? "",
    customerName: initialValue?.customerName ?? "",
    customerEmail: initialValue?.customerEmail ?? "",
    customerPhone: initialValue?.customerPhone ?? "",
    expiresAt: initialValue?.expiresAt?.slice(0, 10) ?? "",
    notes: initialValue?.notes ?? "",
  });
  function updateField(field: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
  }
  const [items, setItems] = useState<LineItem[]>(
    initialValue?.items.length ? initialValue.items : [firstItem],
  );
  const [taxRate, setTaxRate] = useState(
    initialValue ? String(initialValue.taxRate) : "0",
  );

  function updateItem(
    id: string,
    field: "description" | "quantity" | "unitPrice",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    if (items.length >= 20) return;
    setItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const subtotal = items.reduce(
    (total, item) =>
      total + numericValue(item.quantity) * numericValue(item.unitPrice),
    0,
  );
  const taxAmount = (subtotal * numericValue(taxRate)) / 100;
  const total = subtotal + taxAmount;

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <Card className="border-t-4 border-t-brand-700 p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-zinc-950">
            {t("Job and customer")}{" "}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {t("Name the work clearly so it is easy to find later.")}{" "}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="title">{t("Job title")}</Label>
            <Input
              id="title"
              name="title"
              value={fields.title}
              onChange={(event) => updateField("title", event.target.value)}
              required
              autoFocus
              maxLength={140}
              aria-invalid={Boolean(state.fieldErrors?.title)}
              aria-describedby={
                state.fieldErrors?.title ? "title-error" : undefined
              }
              className="mt-1.5"
              placeholder={t("Replace switchboard and safety test")}
            />
            <FieldError id="title-error" message={state.fieldErrors?.title} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="customerName">{t("Customer name")}</Label>
            <Input
              id="customerName"
              name="customerName"
              value={fields.customerName}
              onChange={(event) =>
                updateField("customerName", event.target.value)
              }
              autoComplete="name"
              required
              maxLength={120}
              aria-invalid={Boolean(state.fieldErrors?.customerName)}
              aria-describedby={
                state.fieldErrors?.customerName
                  ? "customer-name-error"
                  : undefined
              }
              className="mt-1.5"
              placeholder={t("Alex Johnson")}
            />
            <FieldError
              id="customer-name-error"
              message={state.fieldErrors?.customerName}
            />
          </div>

          <div>
            <Label htmlFor="customerEmail">
              {t("Customer email")}{" "}
              <span className="font-normal text-zinc-500">
                {t("(optional)")}
              </span>
            </Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              value={fields.customerEmail}
              onChange={(event) =>
                updateField("customerEmail", event.target.value)
              }
              autoComplete="email"
              aria-invalid={Boolean(state.fieldErrors?.customerEmail)}
              aria-describedby={
                state.fieldErrors?.customerEmail
                  ? "customer-email-error"
                  : undefined
              }
              className="mt-1.5"
              placeholder={t("alex@example.com")}
            />
            <FieldError
              id="customer-email-error"
              message={state.fieldErrors?.customerEmail}
            />
          </div>

          <div>
            <Label htmlFor="customerPhone">
              {t("Customer phone")}{" "}
              <span className="font-normal text-zinc-500">
                {t("(optional)")}
              </span>
            </Label>
            <Input
              id="customerPhone"
              name="customerPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={fields.customerPhone}
              onChange={(event) =>
                updateField("customerPhone", event.target.value)
              }
              maxLength={30}
              aria-invalid={Boolean(state.fieldErrors?.customerPhone)}
              aria-describedby={
                state.fieldErrors?.customerPhone
                  ? "customer-phone-error"
                  : undefined
              }
              className="mt-1.5"
              placeholder="090 123 4567"
            />
            <FieldError
              id="customer-phone-error"
              message={state.fieldErrors?.customerPhone}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">
              {t("Quote items")}
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {t("Add labour and materials.")}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addItem}
            disabled={items.length >= 20}
          >
            <Plus aria-hidden="true" weight="bold" />
            {t("Add item")}{" "}
          </Button>
        </div>

        <div className="divide-y divide-zinc-200">
          {items.map((item, index) => {
            const lineTotal =
              numericValue(item.quantity) * numericValue(item.unitPrice);

            return (
              <fieldset key={item.id} className="p-4 sm:p-6">
                <legend className="sr-only">
                  {t("Quote item")} {index + 1}
                </legend>
                <div className="mb-3 flex items-center justify-between sm:hidden">
                  <span className="text-sm font-medium text-zinc-500">
                    {t("Item")} {index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="min-h-11 px-2 text-sm font-medium text-zinc-500 underline-offset-4 hover:text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      {t("Remove")}{" "}
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-5">
                    <Label htmlFor={`${item.id}-description`}>
                      {t("Description")}
                    </Label>
                    <Input
                      id={`${item.id}-description`}
                      name="itemDescription"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.id, "description", event.target.value)
                      }
                      required
                      maxLength={240}
                      className="mt-1.5"
                      placeholder={t("Call-out and repair")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:contents">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`${item.id}-quantity`}>{t("Qty")}</Label>
                      <Input
                        id={`${item.id}-quantity`}
                        name="itemQuantity"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, "quantity", event.target.value)
                        }
                        required
                        className="mt-1.5"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label htmlFor={`${item.id}-price`}>
                        {t("Unit price")}
                      </Label>
                      <Input
                        id={`${item.id}-price`}
                        name="itemUnitPrice"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(item.id, "unitPrice", event.target.value)
                        }
                        required
                        className="mt-1.5"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex min-h-11 items-center justify-between rounded-lg bg-zinc-50 px-3 sm:col-span-2 sm:block sm:bg-transparent sm:px-0 sm:pb-2.5 sm:text-right">
                    <span className="text-sm text-zinc-500 sm:sr-only">
                      {t("Line total")}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-950">
                      {formatMoney(lineTotal, "VND", locale)}
                    </span>
                  </div>

                  <div className="hidden sm:col-span-12 sm:flex sm:justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="min-h-11 px-2 text-sm font-medium text-zinc-500 underline-offset-4 hover:text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        {t("Remove item")}{" "}
                      </button>
                    )}
                  </div>
                </div>
              </fieldset>
            );
          })}
        </div>

        {state.fieldErrors?.items && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-3 sm:px-6">
            <FieldError id="items-error" message={state.fieldErrors.items} />
          </div>
        )}

        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-6">
          <div className="ml-auto max-w-xl space-y-3">
            <div className="grid gap-4 sm:grid-cols-[112px_180px_minmax(160px,1fr)] sm:items-end">
              <div>
                <Label htmlFor="taxRate">{t("Tax rate")}</Label>
                <div className="relative mt-1.5 w-28">
                  <Input
                    id="taxRate"
                    name="taxRate"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(event) => setTaxRate(event.target.value)}
                    aria-invalid={Boolean(state.fieldErrors?.taxRate)}
                    aria-describedby={
                      state.fieldErrors?.taxRate ? "tax-rate-error" : undefined
                    }
                    className="pr-8"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
                    %
                  </span>
                </div>
                <FieldError
                  id="tax-rate-error"
                  message={state.fieldErrors?.taxRate}
                />
              </div>

              <div>
                <Label htmlFor="expiresAt">
                  {t("Valid until")}{" "}
                  <span className="font-normal text-zinc-500">
                    {t("(optional)")}
                  </span>
                </Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  value={fields.expiresAt}
                  onChange={(event) =>
                    updateField("expiresAt", event.target.value)
                  }
                  aria-invalid={Boolean(state.fieldErrors?.expiresAt)}
                  aria-describedby={
                    state.fieldErrors?.expiresAt ? "expiry-error" : undefined
                  }
                  className="mt-1.5"
                />
                <FieldError
                  id="expiry-error"
                  message={state.fieldErrors?.expiresAt}
                />
              </div>

              <div className="space-y-2 sm:pb-2.5">
                <div className="flex items-center justify-between gap-6 text-sm text-zinc-600">
                  <span>{t("Subtotal")}</span>
                  <span className="tabular-nums">
                    {formatMoney(subtotal, "VND", locale)}
                  </span>
                </div>
                {numericValue(taxRate) > 0 && (
                  <div className="flex items-center justify-between gap-6 text-sm text-zinc-600">
                    <span>{t("Tax")}</span>
                    <span className="tabular-nums">
                      {formatMoney(taxAmount, "VND", locale)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-950">
              <span>{t("Total")}</span>
              <span className="tabular-nums">
                {formatMoney(total, "VND", locale)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <Label htmlFor="notes">
          {t("Notes")}{" "}
          <span className="font-normal text-zinc-500">{t("(optional)")}</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          value={fields.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          maxLength={2_000}
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby={
            state.fieldErrors?.notes ? "notes-error" : undefined
          }
          className="mt-1.5"
          placeholder={t(
            "Scope, exclusions, or anything the customer should know.",
          )}
        />
        <FieldError id="notes-error" message={state.fieldErrors?.notes} />
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <SaveQuoteButton editing={Boolean(quoteId)} />
      </div>
    </form>
  );
}
