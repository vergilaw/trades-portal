"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
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
      {copied ? "Copied" : "Copy link"}
      <span className="sr-only" aria-live="polite">
        {copied ? "Portal link copied" : ""}
      </span>
    </Button>
  );
}
