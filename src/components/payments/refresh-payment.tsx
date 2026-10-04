"use client";
import { useI18n } from "@/components/i18n/provider";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshPayment({ auto = false }: { auto?: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [paused, setPaused] = useState(false);
  const started = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    busy.current = pending;
  }, [pending]);
  useEffect(() => {
    if (!auto) return;
    started.current = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - started.current >= 15 * 60 * 1000) {
        setPaused(true);
        return;
      }
      if (document.visibilityState !== "visible" || busy.current) return;
      startTransition(() => router.refresh());
    }, 10000);
    return () => window.clearInterval(timer);
  }, [auto, router]);
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          started.current = Date.now();
          setPaused(false);
          startTransition(() => router.refresh());
        }}
      >
        {pending ? t("Refreshing…") : t("Refresh payment status")}
      </Button>
      {auto && paused && (
        <p className="text-xs text-zinc-500" role="status">
          {t("Auto-refresh paused. Refresh to check again.")}
        </p>
      )}
    </div>
  );
}
