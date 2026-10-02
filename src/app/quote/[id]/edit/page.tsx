import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit quote",
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims) redirect("/login");

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(
      "id, title, customer_name, customer_email, customer_phone, tax_rate, expires_at, notes, status, quote_items(id, description, quantity, unit_price, position)",
    )
    .eq("id", id)
    .single();

  if (error || !quote) notFound();
  if (quote.status !== "sent") redirect(`/quote/${id}?edit=locked`);

  const items = [...quote.quote_items]
    .sort((left, right) => left.position - right.position)
    .map((item) => ({
      id: item.id,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unit_price),
    }));

  return (
    <AppShell email={authData.claims.email}>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/quote/${quote.id}`}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ArrowLeft aria-hidden="true" weight="bold" />
          Back to quote
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
            Edit quote
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-zinc-600">
            Changes appear immediately on the customer portal.
          </p>
        </div>

        <QuoteForm
          quoteId={quote.id}
          initialValue={{
            title: quote.title,
            customerName: quote.customer_name,
            customerEmail: quote.customer_email ?? "",
            customerPhone: quote.customer_phone ?? "",
            taxRate: quote.tax_rate,
            expiresAt: quote.expires_at,
            notes: quote.notes ?? "",
            items,
          }}
        />
      </div>
    </AppShell>
  );
}
