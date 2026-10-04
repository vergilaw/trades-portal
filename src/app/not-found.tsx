import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
export default async function NotFound() {
  const t = await getTranslator();
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center gap-5 px-5 py-10">
      <div>
        <LanguageSwitcher />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
        {t("Page not found")}
      </h1>
      <p className="text-zinc-600">
        {t("This page is unavailable or the link has expired.")}
      </p>
      <Link
        href="/dashboard"
        className={buttonStyles({ className: "self-start" })}
      >
        {t("Go to quotes")}
      </Link>
    </main>
  );
}
