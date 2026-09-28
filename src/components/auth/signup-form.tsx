"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FieldError, SubmitButton } from "@/components/auth/form-fields";
import { signupAction } from "@/lib/auth/actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, {});

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}
      {state.message && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
        >
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="businessName" className="text-sm font-medium text-slate-700">
          Business / tradesperson name{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="businessName"
          name="businessName"
          type="text"
          autoComplete="organization"
          maxLength={100}
          aria-invalid={Boolean(state.fieldErrors?.businessName)}
          aria-describedby={
            state.fieldErrors?.businessName ? "business-name-error" : undefined
          }
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          placeholder="Smith Electrical"
        />
        <FieldError
          id="business-name-error"
          message={state.fieldErrors?.businessName}
        />
      </div>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          placeholder="you@example.com"
        />
        <FieldError id="email-error" message={state.fieldErrors?.email} />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
        <FieldError id="password-error" message={state.fieldErrors?.password} />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="text-sm font-medium text-slate-700"
        >
          Confirm password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          aria-describedby={
            state.fieldErrors?.confirmPassword ? "confirm-password-error" : undefined
          }
          className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
        <FieldError
          id="confirm-password-error"
          message={state.fieldErrors?.confirmPassword}
        />
      </div>

      <SubmitButton>Create account</SubmitButton>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </form>
  );
}
