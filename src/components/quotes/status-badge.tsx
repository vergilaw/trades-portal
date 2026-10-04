import { Badge } from "@/components/ui/badge";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import {
  quoteStatusLabels,
  type QuoteDisplayStatus,
} from "@/lib/quotes/format";

const tones: Record<
  QuoteDisplayStatus,
  "neutral" | "info" | "success" | "danger"
> = {
  draft: "neutral",
  sent: "info",
  approved: "success",
  rejected: "danger",
  expired: "neutral",
};

export async function StatusBadge({ status }: { status: QuoteDisplayStatus }) {
  return (
    <Badge tone={tones[status]}>
      {translate(quoteStatusLabels[status], await getLocale())}
    </Badge>
  );
}
