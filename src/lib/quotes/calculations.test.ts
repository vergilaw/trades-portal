import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateQuoteTotals,
  parseExpiryDate,
  validateQuoteItems,
  type QuoteLineInput,
} from "./calculations";
import { buildDemoQuotes } from "../demo/quotes";

const validItem: QuoteLineInput = {
  description: "Replace switchboard",
  quantity: 2,
  unitPrice: 125.5,
  position: 0,
};

test("calculates subtotal, tax, and total with currency rounding", () => {
  assert.deepEqual(calculateQuoteTotals([validItem], 8.25), {
    subtotal: 251,
    taxAmount: 20.71,
    total: 271.71,
  });
});

test("accepts zero-priced quote items", () => {
  assert.equal(
    validateQuoteItems([{ ...validItem, quantity: 1, unitPrice: 0 }]),
    undefined,
  );
});

test("rejects invalid quantities and prices", () => {
  assert.match(
    validateQuoteItems([{ ...validItem, quantity: 0 }]) ?? "",
    /quantity above 0/,
  );
  assert.match(
    validateQuoteItems([{ ...validItem, unitPrice: -1 }]) ?? "",
    /valid price/,
  );
});

test("parses an expiry date through the end of the selected UTC day", () => {
  assert.deepEqual(
    parseExpiryDate("2026-10-31", new Date("2026-09-30T00:00:00.000Z")),
    { expiresAt: "2026-10-31T23:59:59.999Z" },
  );
});

test("rejects past expiry dates", () => {
  assert.match(
    parseExpiryDate(
      "2026-09-29",
      new Date("2026-09-30T00:00:00.000Z"),
    ).error ?? "",
    /future/,
  );
});

test("rejects calendar dates that do not exist", () => {
  assert.match(
    parseExpiryDate(
      "2026-02-31",
      new Date("2026-01-01T00:00:00.000Z"),
    ).error ?? "",
    /valid expiry date/,
  );
});

test("builds a varied, internally consistent demo workspace", () => {
  const now = new Date("2026-10-02T08:00:00.000Z");
  const quotes = buildDemoQuotes(now);

  assert.equal(quotes.length, 8);
  assert.equal(new Set(quotes.map((quote) => quote.title)).size, quotes.length);
  assert.deepEqual(
    new Set(quotes.map((quote) => quote.status)),
    new Set(["sent", "approved", "rejected"]),
  );
  assert.ok(
    quotes.some(
      (quote) =>
        quote.status === "sent" &&
        quote.expiresAt !== null &&
        new Date(quote.expiresAt) < now,
    ),
  );

  for (const quote of quotes) {
    assert.equal(quote.total, quote.subtotal + quote.taxAmount);
    if (quote.expiresAt) {
      assert.ok(new Date(quote.expiresAt) > new Date(quote.createdAt));
    }
  }
});
