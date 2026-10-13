import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { quotePdfResponse, pdfHeaders } from "@/lib/quotes/pdf-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    return new Response(null, { status: 404, headers: pdfHeaders });
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user)
    return new Response(null, { status: 401, headers: pdfHeaders });
  const { data: quote, error } = await client
    .from("quotes")
    .select(
      "id, public_token, contractor_id, title, customer_name, currency, notes, status, subtotal, tax_rate, tax_amount, total, created_at, expires_at, responded_at, quote_items(id, description, quantity, unit_price, position)",
    )
    .eq("id", id)
    .eq("contractor_id", auth.user.id)
    .single();
  if (error || !quote)
    return new Response(null, { status: 404, headers: pdfHeaders });
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("full_name, business_name, phone")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile)
    return new Response(null, { status: 503, headers: pdfHeaders });
  return quotePdfResponse(
    {
      id: quote.id,
      token: quote.public_token,
      title: quote.title,
      customerName: quote.customer_name,
      currency: quote.currency,
      notes: quote.notes,
      status: quote.status,
      subtotal: quote.subtotal,
      taxRate: quote.tax_rate,
      taxAmount: quote.tax_amount,
      total: quote.total,
      createdAt: quote.created_at,
      expiresAt: quote.expires_at,
      respondedAt: quote.responded_at,
      contractor: {
        name: profile.full_name,
        businessName: profile.business_name,
        phone: profile.phone,
      },
      items: quote.quote_items.map((item) => ({
        ...item,
        unitPrice: item.unit_price,
      })),
    },
    await getLocale(),
  );
}
