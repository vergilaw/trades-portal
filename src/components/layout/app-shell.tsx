import { AppHeader } from "@/components/layout/app-header";

export function AppShell({
  email,
  children,
}: {
  email?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#f4f6f5]">
      <AppHeader email={email} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        {children}
      </main>
    </div>
  );
}
