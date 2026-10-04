import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate("Create account", await getLocale()) };
}

export default async function SignupPage() {
  const locale = await getLocale();
  const t = createTranslator(locale);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      title={t("Create your account")}
      description={t(
        "Start sending clear, professional quotes to your customers.",
      )}
    >
      <SignupForm />
    </AuthShell>
  );
}
