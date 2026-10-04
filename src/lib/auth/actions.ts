"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  message?: string;
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

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: businessName ? { business_name: businessName } : undefined,
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
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
