import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Start sending clear, professional quotes to your customers."
    >
      <SignupForm />
    </AuthShell>
  );
}
