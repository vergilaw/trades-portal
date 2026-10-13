"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  resendConfirmationAction,
} from "@/lib/auth/actions";
import { useI18n } from "@/components/i18n/provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldError, FormAlert } from "./form-fields";

function EmailSubmit({
  mode,
  retryAt,
}: {
  mode: "recovery" | "confirmation";
  retryAt?: number;
}) {
  const { t } = useI18n();
  const { pending } = useFormStatus();
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [retryAt]);
  return (
    <div className="space-y-2">
      <Button
        type="submit"
        className="w-full"
        disabled={pending || remaining > 0}
      >
        {pending
          ? t("Please wait…")
          : t(
              mode === "recovery"
                ? "Send reset link"
                : "Send confirmation link",
            )}
      </Button>
      {remaining > 0 && (
        <p role="status" className="text-sm text-zinc-500">
          {t("You can send another email in {seconds}s.", {
            seconds: remaining,
          })}
        </p>
      )}
    </div>
  );
}

export function EmailLinkForm({
  mode,
  invalidLink = false,
}: {
  mode: "recovery" | "confirmation";
  invalidLink?: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(
    mode === "recovery" ? forgotPasswordAction : resendConfirmationAction,
    {},
  );
  return (
    <form action={action} noValidate className="space-y-5">
      {invalidLink && (
        <FormAlert tone="error">
          {t("This email link is unavailable or expired. Request a new link.")}
        </FormAlert>
      )}
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div>
        <Label htmlFor="email">{t("Email")}</Label>
        <Input
          className="mt-1.5"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={320}
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
        />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>
      <p className="text-sm leading-6 text-zinc-600">
        {t("Open the email link in the same browser where you requested it.")}
      </p>
      <EmailSubmit mode={mode} retryAt={state.retryAt} />
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline"
      >
        {t("Back to sign in")}
      </Link>
    </form>
  );
}
