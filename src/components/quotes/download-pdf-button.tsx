"use client";
import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";

export function DownloadPdfButton({
  path,
  quoteId,
}: {
  path: string;
  quoteId: string;
}) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function download() {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`${path}?lang=${locale}`);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/pdf")
      )
        throw new Error("PDF unavailable");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `bao-gia-${quoteId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="max-w-full">
      <Button
        size="sm"
        variant="secondary"
        disabled={loading}
        onClick={download}
      >
        <DownloadSimple aria-hidden="true" size={17} />
        {t(loading ? "Preparing PDF…" : "Download PDF")}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 max-w-xs text-sm text-red-700">
          {t("PDF could not be generated. Try again.")}
        </p>
      )}
    </div>
  );
}
