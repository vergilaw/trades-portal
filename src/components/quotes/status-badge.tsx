import { Badge } from "@/components/ui/badge";
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

export function StatusBadge({ status }: { status: QuoteDisplayStatus }) {
  return <Badge tone={tones[status]}>{quoteStatusLabels[status]}</Badge>;
}
