"use client";
import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/auth/actions";
import { useI18n } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormAlert, SubmitButton } from "./form-fields";

export function ResetPasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(resetPasswordAction, {});
  return (
    <form action={action} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {(
        [
          ["password", "New password"],
          ["confirmPassword", "Confirm password"],
        ] as const
      ).map(([name, label]) => (
        <div key={name}>
          <Label htmlFor={name}>{t(label)}</Label>
          <Input
            className="mt-1.5"
            id={name}
            name={name}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-invalid={Boolean(state.fieldErrors?.[name])}
            aria-describedby={`${name}-error`}
          />
          <FieldError
            id={`${name}-error`}
            message={state.fieldErrors?.[name]}
          />
        </div>
      ))}
      <p className="text-xs text-zinc-500">{t("Use at least 8 characters.")}</p>
      <SubmitButton>{t("Save new password")}</SubmitButton>
      <Link
        href="/forgot-password"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline"
      >
        {t("Request a new email link")}
      </Link>
    </form>
  );
}
