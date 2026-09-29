"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "@phosphor-icons/react";

import { FieldError, FormAlert } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createQuoteAction } from "@/lib/quotes/actions";
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

function CreateQuoteButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Creating quote..." : "Create quote"}
    </Button>
  );
}

export function QuoteForm() {
  const [state, formAction] = useActionState(createQuoteAction, {});
  const [items, setItems] = useState<LineItem[]>([firstItem]);

  function updateItem(
    id: string,
    field: "description" | "quantity" | "unitPrice",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
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

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <Card className="border-t-4 border-t-brand-700 p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-zinc-950">Customer</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Who is this quote for?
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="customerName">Customer name</Label>
            <Input
              id="customerName"
              name="customerName"
              autoComplete="name"
              required
              autoFocus
              maxLength={120}
              aria-invalid={Boolean(state.fieldErrors?.customerName)}
              aria-describedby={
                state.fieldErrors?.customerName ? "customer-name-error" : undefined
              }
              className="mt-1.5"
              placeholder="Alex Johnson"
            />
            <FieldError
              id="customer-name-error"
              message={state.fieldErrors?.customerName}
            />
          </div>

          <div>
            <Label htmlFor="customerEmail">
              Customer email{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(state.fieldErrors?.customerEmail)}
              aria-describedby={
                state.fieldErrors?.customerEmail ? "customer-email-error" : undefined
              }
              className="mt-1.5"
              placeholder="alex@example.com"
            />
            <FieldError
              id="customer-email-error"
              message={state.fieldErrors?.customerEmail}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 sm:p-6">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Quote items</h2>
            <p className="mt-1 text-sm text-zinc-600">Add labour and materials.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addItem}
            disabled={items.length >= 20}
          >
            <Plus aria-hidden="true" weight="bold" />
            Add item
          </Button>
        </div>

        <div className="divide-y divide-zinc-200">
          {items.map((item, index) => {
            const lineTotal =
              numericValue(item.quantity) * numericValue(item.unitPrice);

            return (
              <fieldset key={item.id} className="p-4 sm:p-6">
                <legend className="sr-only">Quote item {index + 1}</legend>
                <div className="mb-3 flex items-center justify-between sm:hidden">
                  <span className="text-sm font-medium text-zinc-500">
                    Item {index + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="min-h-11 px-2 text-sm font-medium text-zinc-500 underline-offset-4 hover:text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-5">
                    <Label htmlFor={`${item.id}-description`}>Description</Label>
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
                      placeholder="Call-out and repair"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:contents">
                    <div className="sm:col-span-2">
                      <Label htmlFor={`${item.id}-quantity`}>Qty</Label>
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
                      <Label htmlFor={`${item.id}-price`}>Unit price</Label>
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
                    <span className="text-sm text-zinc-500 sm:sr-only">Line total</span>
                    <span className="text-sm font-semibold tabular-nums text-zinc-950">
                      {formatMoney(lineTotal)}
                    </span>
                  </div>

                  <div className="hidden sm:col-span-12 sm:flex sm:justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-sm font-medium text-zinc-500 underline-offset-4 hover:text-red-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        Remove item
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
          <div className="ml-auto max-w-xs space-y-2">
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-semibold text-zinc-950">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-zinc-500">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={2_000}
          aria-invalid={Boolean(state.fieldErrors?.notes)}
          aria-describedby={state.fieldErrors?.notes ? "notes-error" : undefined}
          className="mt-1.5"
          placeholder="Scope, exclusions, or anything the customer should know."
        />
        <FieldError id="notes-error" message={state.fieldErrors?.notes} />
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <CreateQuoteButton />
      </div>
    </form>
  );
}
