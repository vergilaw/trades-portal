import { Badge } from "@/components/ui/badge";
import { quoteStatusLabels } from "@/lib/quotes/format";
import type { QuoteStatus } from "@/types";

const tones: Record<
  QuoteStatus,
  "neutral" | "info" | "success" | "danger"
> = {
  draft: "neutral",
  sent: "info",
  approved: "success",
  rejected: "danger",
};

export function StatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={tones[status]}>{quoteStatusLabels[status]}</Badge>;
}
