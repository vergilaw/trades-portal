"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "./button";

export function RetryButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {t("Try again")}
    </Button>
  );
}
