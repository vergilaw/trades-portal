import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/server";
import { parsePortalQuote } from "@/lib/quotes/portal";
import { quotePdfResponse, pdfHeaders } from "@/lib/quotes/pdf-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      token,
    )
  )
    return new Response(null, { status: 404, headers: pdfHeaders });
  const client = await createClient();
  const { data, error } = await client.rpc("get_portal_quote", {
    p_token: token,
  });
  if (error) {
    console.error("Portal PDF lookup failed", { code: error.code });
    return new Response(null, { status: 503, headers: pdfHeaders });
  }
  if (!data) return new Response(null, { status: 404, headers: pdfHeaders });
  const quote = parsePortalQuote(data);
  if (!quote?.createdAt)
    return new Response(null, { status: 503, headers: pdfHeaders });
  return quotePdfResponse(
    { ...quote, createdAt: quote.createdAt },
    await getLocale(),
  );
}
