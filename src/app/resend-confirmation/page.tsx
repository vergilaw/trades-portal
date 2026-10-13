import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { EmailLinkForm } from "@/components/auth/email-link-form";
import { getTranslator } from "@/lib/i18n/server";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())("Resend confirmation email") };
}
export default async function ResendConfirmationPage() {
  const t = await getTranslator();
  return (
    <AuthShell
      title={t("Resend confirmation email")}
      description={t("Request a new link to confirm your email address.")}
    >
      <EmailLinkForm mode="confirmation" />
    </AuthShell>
  );
}
