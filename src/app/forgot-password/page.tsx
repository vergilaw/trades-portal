import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailLinkForm } from "@/components/auth/email-link-form";
import { getTranslator } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Forgot password") };
}
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslator();
  return (
    <AuthShell
      title={t("Forgot password")}
      description={t("Enter your email to request a password reset link.")}
    >
      <EmailLinkForm
        mode="recovery"
        invalidLink={(await searchParams).error === "invalid_link"}
      />
    </AuthShell>
  );
}
