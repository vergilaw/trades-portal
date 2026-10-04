"use client";
import { useI18n } from "@/components/i18n/provider";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FieldError({ id, message }: { id: string; message?: string }) {
  const { text } = useI18n();
  if (!message) return null;

  return (
    <p id={id} className="mt-1.5 text-sm text-red-600">
      {text(message)}
    </p>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const { text } = useI18n();
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3.5 py-3 text-sm leading-5",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {typeof children === "string" ? text(children) : children}
    </div>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();

  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("Please wait…") : children}
    </Button>
  );
}
