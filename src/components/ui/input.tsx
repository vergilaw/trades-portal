import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-brand-700 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-100 sm:text-sm",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";

export { Input };
