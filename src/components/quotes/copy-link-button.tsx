"use client";
import { useI18n } from "@/components/i18n/provider";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function CopyLinkButton({ path }: { path: string }) {
  const { t, locale } = useI18n();

  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      const url = new URL(path, window.location.origin);
      url.searchParams.set("lang", locale);
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copyLink}>
      {copied ? (
        <Check aria-hidden="true" weight="bold" />
      ) : (
        <Copy aria-hidden="true" weight="bold" />
      )}
      {copied ? t("Copied") : t("Copy link")}
      <span className="sr-only" aria-live="polite">
        {copied ? t("Portal link copied") : ""}
      </span>
    </Button>
  );
}
