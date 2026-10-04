"use client";
import { useI18n } from "@/components/i18n/provider";

import { Copy } from "@phosphor-icons/react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { duplicateQuoteAction } from "@/lib/quotes/actions";

function DuplicateButton() {
  const { t } = useI18n();

  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      <Copy aria-hidden="true" size={17} weight="bold" />
      {pending ? t("Duplicating...") : t("Duplicate")}
    </Button>
  );
}

export function DuplicateQuoteButton({ quoteId }: { quoteId: string }) {
  const action = duplicateQuoteAction.bind(null, quoteId);

  return (
    <form action={action}>
      <DuplicateButton />
    </form>
  );
}
