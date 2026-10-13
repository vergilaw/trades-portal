import { createTranslator, type Locale } from "@/lib/i18n/shared";
import { formatMoney } from "@/lib/quotes/format";
import type { DashboardSummary } from "@/lib/quotes/summary";
import { RetryButton } from "@/components/ui/retry-button";

export function QuoteSummary({
  summary,
  locale,
}: {
  summary: DashboardSummary | null;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  if (!summary)
    return (
      <section
        aria-label={t("Quote overview")}
        className="mt-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5"
      >
        <p role="alert" className="text-sm text-amber-900">
          {t("Quote overview could not be loaded. Try again.")}
        </p>
        <RetryButton />
      </section>
    );
  const totals = summary.totals.length
    ? summary.totals
    : [{ currency: "VND", approved: "0", received: "0", outstanding: "0" }];
  return (
    <section aria-label={t("Quote overview")} className="mt-6">
      <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["all", "All quotes"],
            ["pending", "Awaiting response"],
            ["approved", "Approved"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="min-w-0 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">{t(label)}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
              {summary.counts[key]}
            </p>
          </div>
        ))}
        {(
          [
            ["approved", "Approved value"],
            ["received", "Received value"],
            ["outstanding", "Outstanding value"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="min-w-0 bg-white px-5 py-4">
            <p className="text-sm text-zinc-500">{t(label)}</p>
            <div className="mt-1 space-y-1">
              {totals.map((row) => (
                <p
                  key={row.currency}
                  className="break-words text-xl font-semibold tabular-nums text-zinc-950"
                >
                  {formatMoney(row[key], row.currency, locale)}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {t("All-time totals. Search and filters apply to the quote list only.")}
      </p>
    </section>
  );
}
