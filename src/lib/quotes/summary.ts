import type { Json } from "@/types";

export type DashboardSummary = {
  counts: { all: number; pending: number; approved: number };
  totals: Array<{
    currency: string;
    approved: string;
    received: string;
    outstanding: string;
  }>;
};

export function parseDashboardSummary(value: Json): DashboardSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const counts = value.counts;
  if (
    !counts ||
    typeof counts !== "object" ||
    Array.isArray(counts) ||
    !Array.isArray(value.totals)
  )
    return null;
  if (
    ![counts.all, counts.pending, counts.approved].every(
      (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0,
    )
  )
    return null;
  const totals: DashboardSummary["totals"] = [];
  for (const row of value.totals) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      typeof row.currency !== "string" ||
      !/^[A-Z]{3}$/.test(row.currency)
    )
      return null;
    if (
      ![row.approved, row.received, row.outstanding].every(
        (v) => typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v),
      )
    )
      return null;
    totals.push(row as DashboardSummary["totals"][number]);
  }
  return { counts: counts as DashboardSummary["counts"], totals };
}
