import { Brand } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#f4f6f5] px-4 py-8 sm:px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex items-center justify-between gap-2">
          <Brand href="/" />
          <LanguageSwitcher />
        </div>

        <Card className="overflow-hidden border-t-4 border-t-brand-700 p-5 sm:p-7">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-6 text-zinc-600">
              {description}
            </p>
          </div>
          {children}
        </Card>
      </div>
    </main>
  );
}
