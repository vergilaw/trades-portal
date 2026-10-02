export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  position: number;
};

export type QuoteTotals = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateQuoteTotals(
  items: Pick<QuoteLineInput, "quantity" | "unitPrice">[],
  taxRate: number,
): QuoteTotals {
  const subtotal = roundCurrency(
    items.reduce(
      (runningTotal, item) =>
        runningTotal + item.quantity * item.unitPrice,
      0,
    ),
  );
  const taxAmount = roundCurrency((subtotal * taxRate) / 100);

  return {
    subtotal,
    taxAmount,
    total: roundCurrency(subtotal + taxAmount),
  };
}

export function validateQuoteItems(items: QuoteLineInput[]) {
  if (items.length === 0 || items.length > 20) {
    return "Add between 1 and 20 valid quote items.";
  }

  if (
    items.some(
      (item) =>
        !item.description ||
        item.description.length > 240 ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0,
    )
  ) {
    return "Each item needs a description, a quantity above 0, and a valid price.";
  }

  return undefined;
}

export function parseExpiryDate(value: string, now = new Date()) {
  if (!value) return { expiresAt: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { expiresAt: null, error: "Enter a valid expiry date." };
  }

  const expiresAt = new Date(`${value}T23:59:59.999Z`);
  if (
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt.toISOString().slice(0, 10) !== value
  ) {
    return { expiresAt: null, error: "Enter a valid expiry date." };
  }
  if (expiresAt <= now) {
    return { expiresAt: null, error: "Choose an expiry date in the future." };
  }

  return { expiresAt: expiresAt.toISOString() };
}
