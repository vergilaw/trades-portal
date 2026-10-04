import { UserCircle, SignOut } from "@phosphor-icons/react/dist/ssr";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AppNavigation } from "./app-navigation";
import { getTranslator } from "@/lib/i18n/server";
import { logoutAction } from "@/lib/auth/actions";

export async function AppHeader({ email }: { email?: string }) {
  const t = await getTranslator();
  return (
    <header className="border-b border-zinc-200 border-t-4 border-t-brand-700 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-16 items-center justify-between gap-2">
          <Brand />
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <details className="relative">
              <summary
                aria-label={t("Account")}
                className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                <UserCircle size={26} aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
                <p className="break-all px-2 py-3 text-sm text-zinc-600">
                  {email}
                </p>
                <form action={logoutAction}>
                  <Button
                    type="submit"
                    variant="ghost"
                    className="w-full justify-start"
                  >
                    <SignOut size={18} aria-hidden="true" />
                    {t("Log out")}
                  </Button>
                </form>
              </div>
            </details>
          </div>
        </div>
        <AppNavigation />
      </div>
    </header>
  );
}
