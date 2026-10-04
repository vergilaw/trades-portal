"use client";
import { useI18n } from "@/components/i18n/provider";

import { useActionState, type ReactNode } from "react";
import { FormAlert } from "@/components/auth/form-fields";
import type { PaymentActionState } from "@/lib/payments/actions";

export function PaymentActionForm({
  action,
  children,
  className = "space-y-3",
}: {
  action: (
    state: PaymentActionState,
    form: FormData,
  ) => Promise<PaymentActionState>;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();

  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <fieldset
        disabled={pending}
        aria-busy={pending}
        className="min-w-0 space-y-3 disabled:opacity-60"
      >
        {children}
      </fieldset>
      {pending && (
        <p role="status" className="text-sm text-zinc-500">
          {t("Saving…")}
        </p>
      )}
    </form>
  );
}
