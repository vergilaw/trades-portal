import { FilePlus } from "@phosphor-icons/react/dist/ssr";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start px-5 py-12 sm:px-8 sm:py-14">
      <div className="mb-5 flex size-11 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-800">
        <FilePlus aria-hidden="true" size={22} weight="duotone" />
      </div>
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-zinc-950">
        {title}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-zinc-600">
        {description}
      </p>
      <div className="mt-5">{action}</div>
    </div>
  );
}
