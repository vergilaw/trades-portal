import { GearSix, SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Brand } from "@/components/ui/brand";
import { Button, buttonStyles } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

export function AppHeader({ email }: { email?: string }) {
  const initial = email?.charAt(0).toUpperCase() || "U";

  return (
    <header className="border-b border-zinc-200 border-t-4 border-t-brand-700 bg-white">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />

        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
              {initial}
            </span>
            {email && (
              <span className="max-w-48 truncate text-sm text-zinc-600">{email}</span>
            )}
          </div>
          <Link
            href="/settings"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            <GearSix aria-hidden="true" size={17} weight="bold" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sr-only sm:hidden">Settings</span>
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <SignOut aria-hidden="true" size={17} weight="bold" />
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
