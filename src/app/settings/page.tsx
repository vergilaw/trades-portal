import { getLocale } from "@/lib/i18n/server";
import { createTranslator, translate } from "@/lib/i18n/shared";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { BankAccounts } from "@/components/payments/bank-accounts";
import { SePaySettings } from "@/components/payments/sepay-settings";
import { ProfileForm } from "@/components/profile/profile-form";
import { DemoDataImporter } from "@/components/profile/demo-data-importer";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: translate("Business profile", await getLocale()) };
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = createTranslator(locale);

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims.sub;

  if (authError || !userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, business_name, phone")
    .eq("id", userId)
    .maybeSingle();
  const demoImportEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEMO_DATA_IMPORT === "true";
  const { data: bankAccounts, error: bankAccountsError } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("created_at");
  const [connectionResult, linkedResult] = await Promise.all([
    supabase.from("sepay_connections").select("*").maybeSingle(),
    supabase.from("sepay_connection_accounts").select("bank_account_id"),
  ]);
  let appUrl = "";
  try {
    const configuredUrl = new URL(process.env.APP_URL ?? "");
    if (
      configuredUrl.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        configuredUrl.protocol === "http:")
    )
      appUrl = configuredUrl.origin;
  } catch {
    /* Display configuration guidance until a public URL is set. */
  }

  return (
    <AppShell email={authData.claims.email}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ArrowLeft aria-hidden="true" weight="bold" />
          {t("Back to quotes")}{" "}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
            {t("Business profile")}{" "}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
            {t(
              "These details identify your business on customer quote portals.",
            )}{" "}
          </p>
        </div>

        <Card className="border-t-4 border-t-brand-700 p-4 sm:p-6">
          <ProfileForm
            email={authData.claims.email}
            profile={{
              fullName: profile?.full_name ?? "",
              businessName: profile?.business_name ?? "",
              phone: profile?.phone ?? "",
            }}
          />
        </Card>

        <Card className="mt-5 p-4 sm:p-6">
          <BankAccounts
            accounts={bankAccounts ?? []}
            unavailable={Boolean(bankAccountsError)}
          />
        </Card>
        <Card className="mt-5 p-4 sm:p-6">
          <SePaySettings
            accounts={bankAccounts ?? []}
            connection={connectionResult.data}
            linkedIds={(linkedResult.data ?? []).map(
              (link) => link.bank_account_id,
            )}
            appUrl={appUrl}
            unavailable={Boolean(
              connectionResult.error || linkedResult.error || bankAccountsError,
            )}
            ready={Boolean(
              appUrl &&
              process.env.SUPABASE_SECRET_KEY &&
              process.env.SEPAY_ENCRYPTION_KEY,
            )}
          />
        </Card>

        {demoImportEnabled && (
          <Card className="mt-5 border-l-4 border-l-amber-500 p-4 sm:p-6">
            <DemoDataImporter />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
