import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in",
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const initialError =
    params.error === "confirmation_failed"
      ? "We could not confirm that email link. It may have expired."
      : undefined;

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to create and manage your customer quotes."
    >
      <LoginForm initialError={initialError} />
    </AuthShell>
  );
}
