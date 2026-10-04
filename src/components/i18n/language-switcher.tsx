"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "./provider";
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <label className="inline-flex min-h-11 items-center">
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={locale}
        disabled={pending}
        className="h-11 rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-700 focus-visible:outline-2 focus-visible:outline-brand-700"
        onChange={(event) => {
          const query = new URLSearchParams(params.toString());
          query.set("lang", event.target.value);
          startTransition(() =>
            router.replace(`${path}?${query.toString()}`, { scroll: false }),
          );
        }}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
