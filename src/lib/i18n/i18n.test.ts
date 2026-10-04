import assert from "node:assert/strict";
import test from "node:test";
import { createTranslator, resolveLocale, translate } from "./shared";
import { messages } from "./messages";
import {
  formatMoney,
  formatExpiryDate,
  formatQuoteDate,
} from "../quotes/format";
import { paymentDate } from "../payments/format";

test("Language selection gives share links precedence over cookies and defaults to Vietnamese", () => {
  assert.equal(resolveLocale(null, undefined), "vi");
  assert.equal(resolveLocale("en", "vi"), "en");
  assert.equal(resolveLocale("vi", "en"), "vi");
  assert.equal(resolveLocale("bad", "en"), "en");
  assert.equal(resolveLocale(null, "bad"), "vi");
});
test("Dictionaries keep placeholders consistent and user data is not rewritten", () => {
  for (const [en, vi] of Object.entries(messages))
    assert.deepEqual(
      [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      [...vi.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      en,
    );
  assert.equal(
    createTranslator("vi")("No quotes match “{search}”", {
      search: "English customer data",
    }),
    "Không có báo giá khớp với “English customer data”",
  );
  assert.equal(
    translate("Unmodified user content", "vi"),
    "Unmodified user content",
  );
  assert.equal(createTranslator("en")("Quotes"), "Quotes");
});
test("Money and dates follow language while expiry keeps its original UTC calendar day", () => {
  assert.match(formatMoney(1500000, "VND", "vi"), /1\.500\.000/);
  assert.match(formatMoney(1500000, "VND", "en"), /1,500,000/);
  const boundary = "2026-10-03T23:59:59.999Z";
  assert.match(formatExpiryDate(boundary, "vi"), /3/);
  assert.match(formatQuoteDate(boundary, "vi"), /4/);
  assert.match(paymentDate("2026-10-04T03:30:00Z", "vi"), /10:30/);
});
