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
import { loginAction, type AuthActionState } from "@/lib/auth/actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const initialState: AuthActionState = initialError ? { error: initialError } : {};
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
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
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className="mt-1.5"
        />
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>

      <SubmitButton>Sign in</SubmitButton>

      <p className="text-center text-sm text-zinc-600">
        New to Trades Portal?{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
