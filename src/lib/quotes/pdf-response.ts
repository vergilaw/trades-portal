import type { Locale } from "@/lib/i18n/shared";
import { renderQuotePdf, type PdfQuote } from "./pdf";

export const pdfHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function quotePdfResponse(quote: PdfQuote, locale: Locale) {
  try {
    const buffer = await renderQuotePdf(quote, locale);
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...pdfHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bao-gia-${quote.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch {
    console.error("Quote PDF render failed", { operation: "quote_pdf" });
    return Response.json(
      { error: "PDF could not be generated. Try again." },
      { status: 503, headers: pdfHeaders },
    );
  }
}
