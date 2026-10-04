"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/provider";
import { cn } from "@/lib/utils";
export function AppNavigation() {
  const path = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("Account")}
      className="grid grid-cols-3 gap-1 pb-2 sm:flex"
    >
      {(
        [
          ["/dashboard", "Quotes"],
          ["/payments", "Payments"],
          ["/settings", "Settings"],
        ] as const
      ).map(([href, label]) => {
        const active =
          href === "/dashboard"
            ? path === href || path.startsWith("/quote/")
            : path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-700",
              active
                ? "bg-brand-50 text-brand-800"
                : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
