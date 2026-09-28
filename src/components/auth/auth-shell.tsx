import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-slate-950"
          aria-label="Trades Portal home"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-sm">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight">Trades Portal</span>
        </Link>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
