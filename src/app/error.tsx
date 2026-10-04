"use client";
import { useI18n } from "@/components/i18n/provider";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950">
        {t("Something went wrong")}
      </h1>
      <p role="alert" className="text-zinc-600">
        {t("This page could not be loaded. Try again.")}
      </p>
      <Button onClick={reset}>{t("Try again")}</Button>
    </main>
  );
}
