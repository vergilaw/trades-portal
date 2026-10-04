import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate("Sign in", await getLocale()) };
}

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const locale = await getLocale();
  const t = createTranslator(locale);

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
      title={t("Welcome back")}
      description={t("Sign in to create and manage your customer quotes.")}
    >
      <LoginForm initialError={initialError} />
    </AuthShell>
  );
}
