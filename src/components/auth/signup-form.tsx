"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  FieldError,
  FormAlert,
  SubmitButton,
} from "@/components/auth/form-fields";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, {});

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <div>
        <Label htmlFor="businessName">
          Business or tradesperson name{" "}
          <span className="font-normal text-zinc-500">(optional)</span>
        </Label>
        <Input
          id="businessName"
          name="businessName"
          type="text"
          autoComplete="organization"
          maxLength={100}
          aria-invalid={Boolean(state.fieldErrors?.businessName)}
          aria-describedby={
            state.fieldErrors?.businessName ? "business-name-error" : undefined
          }
          className="mt-1.5"
          placeholder="Smith Electrical"
        />
        <FieldError
          id="business-name-error"
          message={state.fieldErrors?.businessName}
        />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="mt-1.5"
          placeholder="you@example.com"
        />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby="password-help password-error"
          className="mt-1.5"
        />
        <p id="password-help" className="mt-1.5 text-xs text-zinc-500">
          Use at least 8 characters.
        </p>
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          aria-describedby={
            state.fieldErrors?.confirmPassword ? "confirm-password-error" : undefined
          }
          className="mt-1.5"
        />
        <FieldError
          id="confirm-password-error"
          message={state.fieldErrors?.confirmPassword}
        />
      </div>

      <SubmitButton>Create account</SubmitButton>

      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
