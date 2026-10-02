"use server";

import { redirect } from "next/navigation";

import {
  calculateQuoteTotals,
  parseExpiryDate,
  validateQuoteItems,
  type QuoteLineInput,
} from "@/lib/quotes/calculations";
import { createClient } from "@/lib/supabase/server";

export type QuoteActionState = {
  error?: string;
  fieldErrors?: Partial<
    Record<
      | "title"
      | "customerName"
      | "customerEmail"
      | "customerPhone"
      | "items"
      | "taxRate"
      | "expiresAt"
      | "notes",
      string
    >
  >;
};

type ValidQuoteInput = {
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  taxRate: number;
  expiresAt: string | null;
  items: QuoteLineInput[];
  subtotal: number;
  taxAmount: number;
  total: number;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+().\-\s]{7,30}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function listValues(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => (typeof value === "string" ? value.trim() : ""));
}

function parseQuoteForm(formData: FormData):
  | { values: ValidQuoteInput; fieldErrors?: never }
  | { values?: never; fieldErrors: NonNullable<QuoteActionState["fieldErrors"]> } {
  const title = stringValue(formData, "title");
  const customerName = stringValue(formData, "customerName");
  const customerEmail = stringValue(formData, "customerEmail").toLowerCase();
  const customerPhone = stringValue(formData, "customerPhone");
  const taxRate = Number(stringValue(formData, "taxRate"));
  const notes = stringValue(formData, "notes");
  const expiry = parseExpiryDate(stringValue(formData, "expiresAt"));
  const descriptions = listValues(formData, "itemDescription");
  const quantities = listValues(formData, "itemQuantity");
  const unitPrices = listValues(formData, "itemUnitPrice");
  const fieldErrors: NonNullable<QuoteActionState["fieldErrors"]> = {};

  if (!title || title.length > 140) {
    fieldErrors.title = "Enter a job title up to 140 characters.";
  }
  if (!customerName || customerName.length > 120) {
    fieldErrors.customerName = "Enter a customer name up to 120 characters.";
  }
  if (customerEmail && !emailPattern.test(customerEmail)) {
    fieldErrors.customerEmail = "Enter a valid email address.";
  }
  if (customerPhone && !phonePattern.test(customerPhone)) {
    fieldErrors.customerPhone = "Enter a valid phone number.";
  }
  if (notes.length > 2_000) {
    fieldErrors.notes = "Notes must be 2,000 characters or fewer.";
  }
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    fieldErrors.taxRate = "Enter a tax rate between 0 and 100.";
  }
  if (expiry.error) {
    fieldErrors.expiresAt = expiry.error;
  }
  if (
    descriptions.length !== quantities.length ||
    descriptions.length !== unitPrices.length
  ) {
    fieldErrors.items = "Add between 1 and 20 valid quote items.";
  }

  const items = descriptions.map((description, position) => ({
    description,
    quantity: Number(quantities[position]),
    unitPrice: Number(unitPrices[position]),
    position,
  }));
  const itemError = validateQuoteItems(items);
  if (itemError) fieldErrors.items = itemError;

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const totals = calculateQuoteTotals(items, taxRate);
  return {
    values: {
      title,
      customerName,
      customerEmail,
      customerPhone,
      notes,
      taxRate,
      expiresAt: expiry.expiresAt,
      items,
      ...totals,
    },
  };
}

export async function createQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.values) return { fieldErrors: parsed.fieldErrors };

  const values = parsed.values;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims.sub) {
    redirect("/login");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      contractor_id: authData.claims.sub,
      title: values.title,
      customer_name: values.customerName,
      customer_email: values.customerEmail || null,
      customer_phone: values.customerPhone || null,
      notes: values.notes || null,
      status: "sent",
      tax_rate: values.taxRate,
      subtotal: values.subtotal,
      tax_amount: values.taxAmount,
      total: values.total,
      expires_at: values.expiresAt,
    })
    .select("id, public_token")
    .single();

  if (quoteError || !quote) {
    return { error: "We could not create the quote. Please try again." };
  }

  const { error: itemsError } = await supabase.from("quote_items").insert(
    values.items.map((item) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      position: item.position,
    })),
  );

  if (itemsError) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "We could not save the quote items. Please try again." };
  }

  redirect(`/dashboard?created=${quote.public_token}`);
}

export async function updateQuoteAction(
  quoteId: string,
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  if (!uuidPattern.test(quoteId)) {
    return { error: "This quote could not be updated." };
  }

  const parsed = parseQuoteForm(formData);
  if (!parsed.values) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims.sub) redirect("/login");

  const values = parsed.values;
  const { data, error } = await supabase.rpc("update_quote_with_items", {
    p_quote_id: quoteId,
    p_title: values.title,
    p_customer_name: values.customerName,
    p_customer_email: values.customerEmail || null,
    p_customer_phone: values.customerPhone || null,
    p_notes: values.notes || null,
    p_tax_rate: values.taxRate,
    p_expires_at: values.expiresAt,
    p_items: values.items,
  });

  if (error || data.length === 0) {
    return {
      error:
        "This quote could not be updated. Only pending quotes can be edited.",
    };
  }

  redirect(`/quote/${quoteId}?updated=1`);
}

export async function duplicateQuoteAction(quoteId: string, _formData: FormData) {
  void _formData;

  if (!uuidPattern.test(quoteId)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  if (authError || !authData?.claims.sub) redirect("/login");

  const { data, error } = await supabase.rpc("duplicate_quote", {
    p_quote_id: quoteId,
  });
  const duplicate = data?.[0];

  if (error || !duplicate) {
    redirect(`/quote/${quoteId}?duplicate=error`);
  }

  redirect(`/quote/${duplicate.quote_id}?duplicated=1`);
}

export async function respondToQuoteAction(
  token: string,
  decision: "approved" | "rejected",
  _formData: FormData,
) {
  void _formData;

  if (!uuidPattern.test(token)) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_to_portal_quote", {
    p_token: token,
    p_decision: decision,
  });

  if (error || data.length === 0) {
    redirect(`/portal/${token}?response=unavailable`);
  }

  redirect(`/portal/${token}`);
}
