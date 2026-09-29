import type { QuoteStatus } from "@/types";

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

export function shortQuoteId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};
