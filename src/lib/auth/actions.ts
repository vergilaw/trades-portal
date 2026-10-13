"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import { passwordErrors } from "./recovery";

export type AuthActionState = {
  error?: string;
  message?: string;
  retryAt?: number;
  fieldErrors?: Partial<
    Record<"email" | "password" | "confirmPassword" | "businessName", string>
  >;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readField(formData: FormData, name: string, trim = true) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return trim ? value.trim() : value;
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "The email or password is incorrect.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email before signing in.";
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (normalized.includes("password")) {
    return "Please use a stronger password and try again.";
  }

  return "Something went wrong. Please try again.";
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password", false);
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!emailPattern.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!password) {
    fieldErrors.password = "Enter your password.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  redirect("/dashboard");
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password", false);
  const confirmPassword = readField(formData, "confirmPassword", false);
  const businessName = readField(formData, "businessName");
  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!emailPattern.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (password.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters.";
  }
  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }
  if (businessName.length > 100) {
    fieldErrors.businessName = "Name must be 100 characters or fewer.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: businessName ? { business_name: businessName } : undefined,
      emailRedirectTo: appUrl("/auth/callback"),
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    message:
      "Account created. Check your inbox to confirm your email, then sign in.",
  };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

async function sendAuthEmail(
  mode: "recovery" | "confirmation",
  form: FormData,
): Promise<AuthActionState> {
  const email = readField(form, "email").toLowerCase();
  if (!emailPattern.test(email) || email.length > 320)
    return { fieldErrors: { email: "Enter a valid email address." } };
  const retryAt = Date.now() + 60_000;
  try {
    const client = await createClient();
    const { error } =
      mode === "recovery"
        ? await client.auth.resetPasswordForEmail(email, {
            redirectTo: appUrl("/auth/callback?next=/reset-password"),
          })
        : await client.auth.resend({
            type: "signup",
            email,
            options: { emailRedirectTo: appUrl("/auth/callback") },
          });
    if (error) {
      console.error("Auth email request failed", {
        operation: mode,
        code: error.code,
        status: error.status,
      });
      if (error.status === 429)
        return {
          error: "Too many email requests. Wait before trying again.",
          retryAt,
        };
      // Account-specific failures must not reveal whether the address exists.
      if (error.status && error.status >= 500)
        return { error: "Email could not be sent. Try again later.", retryAt };
    }
    return {
      message:
        mode === "recovery"
          ? "If this account can receive recovery emails, a password reset link will arrive shortly."
          : "If this account needs confirmation, a confirmation link will arrive shortly.",
      retryAt,
    };
  } catch {
    console.error("Auth email request unavailable", { operation: mode });
    return { error: "Email could not be sent. Try again later.", retryAt };
  }
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  form: FormData,
) {
  return sendAuthEmail("recovery", form);
}

export async function resendConfirmationAction(
  _state: AuthActionState,
  form: FormData,
) {
  return sendAuthEmail("confirmation", form);
}

export async function resetPasswordAction(
  _state: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const client = await createClient();
  const { data, error: sessionError } = await client.auth.getUser();
  if (sessionError || !data.user)
    return {
      error: "Your reset session is unavailable. Request a new email link.",
    };
  const password = readField(form, "password", false);
  const fieldErrors = passwordErrors(
    password,
    readField(form, "confirmPassword", false),
  );
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    console.error("Password update failed", {
      code: error.code,
      status: error.status,
    });
    return { error: friendlyAuthError(error.message) };
  }
  const { error: signOutError } = await client.auth.signOut();
  if (signOutError) {
    console.error("Password reset sign-out failed", {
      code: signOutError.code,
    });
    await client.auth.signOut({ scope: "local" });
  }
  redirect("/login?password_updated=1");
}
