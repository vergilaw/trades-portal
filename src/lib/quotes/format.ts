import type { QuoteStatus } from "@/types";
import { intlLocale, type Locale } from "@/lib/i18n/shared";

export type QuoteDisplayStatus = QuoteStatus | "expired";

export function formatMoney(
  amount: number,
  currency = "VND",
  locale: Locale = "vi",
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount);
}

export function formatQuoteDate(value: string, locale: Locale = "vi") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function formatExpiryDate(value: string, locale: Locale = "vi") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function shortQuoteId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function isQuoteExpired(expiresAt: string | null, now = new Date()) {
  return Boolean(expiresAt && new Date(expiresAt) <= now);
}

export const quoteStatusLabels: Record<QuoteDisplayStatus, string> = {
  draft: "Draft",
  sent: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};
