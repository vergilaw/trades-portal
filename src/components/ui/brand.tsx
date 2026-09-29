import { Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2.5 rounded-md text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
      aria-label="Trades Portal"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-700 text-white shadow-[0_1px_1px_rgba(13,111,101,0.2)]">
        <Wrench aria-hidden="true" size={19} weight="bold" />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">
        Trades Portal
      </span>
    </Link>
  );
}
