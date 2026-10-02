import type { QuoteStatus } from "@/types";

export type QuoteDisplayStatus = QuoteStatus | "expired";

export function formatMoney(amount: number, currency = "VND") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount);
}

export function formatQuoteDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatExpiryDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
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
