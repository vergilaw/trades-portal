import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-55",
    {
      "bg-brand-700 text-white shadow-[0_1px_1px_rgba(13,111,101,0.18)] hover:bg-brand-800":
        variant === "primary",
      "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50":
        variant === "secondary",
      "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950": variant === "ghost",
      "bg-red-600 text-white shadow-sm hover:bg-red-700": variant === "danger",
      "h-9 px-3": size === "sm",
      "h-11 px-4": size === "md",
      "h-12 px-6 text-base": size === "lg",
      "size-11": size === "icon",
    },
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonStyles({ variant, size, className })}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export { Button };
