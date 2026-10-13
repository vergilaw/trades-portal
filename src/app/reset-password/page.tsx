import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getTranslator } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { buttonStyles } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Set a new password") };
}
export default async function ResetPasswordPage() {
  const t = await getTranslator();
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return (
    <AuthShell
      title={t("Set a new password")}
      description={t("Choose a password with at least 8 characters.")}
    >
      {error || !data.user ? (
        <div className="space-y-4">
          <p role="alert" className="text-sm text-red-700">
            {t("Your reset session is unavailable. Request a new email link.")}
          </p>
          <Link href="/forgot-password" className={buttonStyles()}>
            {t("Request a new email link")}
          </Link>
        </div>
      ) : (
        <ResetPasswordForm />
      )}
    </AuthShell>
  );
}
