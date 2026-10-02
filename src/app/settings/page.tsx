import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ProfileForm } from "@/components/profile/profile-form";
import { DemoDataImporter } from "@/components/profile/demo-data-importer";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Business profile",
};

export default async function SettingsPage() {
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

  return (
    <AppShell email={authData.claims.email}>
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ArrowLeft aria-hidden="true" weight="bold" />
          Back to quotes
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
            Business profile
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
            These details identify your business on customer quote portals.
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

        {demoImportEnabled && (
          <Card className="mt-5 border-l-4 border-l-amber-500 p-4 sm:p-6">
            <DemoDataImporter />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
