"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildDemoQuotes, demoQuoteTitles } from "@/lib/demo/quotes";
import { createClient } from "@/lib/supabase/server";

export type DemoImportState = {
  error?: string;
  message?: string;
  count?: number;
};

export async function importDemoDataAction(
  _previousState: DemoImportState,
  _formData: FormData,
): Promise<DemoImportState> {
  void _previousState;
  void _formData;

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEMO_DATA_IMPORT !== "true"
  ) {
    return { error: "Demo data import is disabled in production." };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims.sub;
  if (authError || !userId) redirect("/login");

  const { data: existingQuotes, error: existingError } = await supabase
    .from("quotes")
    .select("title")
    .in("title", demoQuoteTitles);

  if (existingError) {
    return { error: "Existing quotes could not be checked. Try again." };
  }

  const existingTitles = new Set(
    (existingQuotes ?? []).map((quote) => quote.title),
  );
  const newQuotes = buildDemoQuotes().filter(
    (quote) => !existingTitles.has(quote.title),
  );

  if (newQuotes.length === 0) {
    return { message: "The realistic demo workspace is already loaded." };
  }

  const { data: insertedQuotes, error: quoteError } = await supabase
    .from("quotes")
    .insert(
      newQuotes.map((quote) => ({
        contractor_id: userId,
        title: quote.title,
        customer_name: quote.customerName,
        customer_email: quote.customerEmail,
        customer_phone: quote.customerPhone,
        currency: "VND",
        notes: quote.notes,
        status: quote.status,
        tax_rate: quote.taxRate,
        subtotal: quote.subtotal,
        tax_amount: quote.taxAmount,
        total: quote.total,
        expires_at: quote.expiresAt,
        responded_at: quote.respondedAt,
        created_at: quote.createdAt,
        updated_at: quote.respondedAt ?? quote.createdAt,
      })),
    )
    .select("id, title");

  if (quoteError || !insertedQuotes) {
    return { error: "Demo quotes could not be created. Try again." };
  }

  const idByTitle = new Map(
    insertedQuotes.map((quote) => [quote.title, quote.id]),
  );
  const insertedIds = insertedQuotes.map((quote) => quote.id);
  const itemRows = newQuotes.flatMap((quote) => {
    const quoteId = idByTitle.get(quote.title);
    if (!quoteId) return [];

    return quote.items.map((item, position) => ({
      quote_id: quoteId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      position,
      created_at: quote.createdAt,
      updated_at: quote.createdAt,
    }));
  });

  const { error: itemError } = await supabase
    .from("quote_items")
    .insert(itemRows);

  if (itemError) {
    await supabase.from("quotes").delete().in("id", insertedIds);
    return {
      error: "Demo line items could not be created. No demo data was kept.",
    };
  }

  revalidatePath("/dashboard");
  return {
    message: "{count} realistic demo quotes added to your workspace.",
    count: newQuotes.length,
  };
}
