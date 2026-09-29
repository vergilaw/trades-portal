"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type QuoteActionState = {
  error?: string;
  fieldErrors?: Partial<
    Record<"customerName" | "customerEmail" | "items" | "notes", string>
  >;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

export async function createQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const customerName = stringValue(formData, "customerName");
  const customerEmail = stringValue(formData, "customerEmail").toLowerCase();
  const notes = stringValue(formData, "notes");
  const descriptions = listValues(formData, "itemDescription");
  const quantities = listValues(formData, "itemQuantity");
  const unitPrices = listValues(formData, "itemUnitPrice");
  const fieldErrors: QuoteActionState["fieldErrors"] = {};

  if (!customerName || customerName.length > 120) {
    fieldErrors.customerName = "Enter a customer name up to 120 characters.";
  }
  if (customerEmail && !emailPattern.test(customerEmail)) {
    fieldErrors.customerEmail = "Enter a valid email address.";
  }
  if (notes.length > 2_000) {
    fieldErrors.notes = "Notes must be 2,000 characters or fewer.";
  }
  if (
    descriptions.length === 0 ||
    descriptions.length > 20 ||
    descriptions.length !== quantities.length ||
    descriptions.length !== unitPrices.length
  ) {
    fieldErrors.items = "Add between 1 and 20 valid quote items.";
  }

  const items = descriptions.map((description, index) => ({
    description,
    quantity: Number(quantities[index]),
    unitPrice: Number(unitPrices[index]),
    position: index,
  }));

  if (
    items.some(
      (item) =>
        !item.description ||
        item.description.length > 240 ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0,
    )
  ) {
    fieldErrors.items =
      "Each item needs a description, a quantity above 0, and a valid price.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const subtotal = items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0,
  );
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();

  if (authError || !authData?.claims.sub) {
    redirect("/login");
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      contractor_id: authData.claims.sub,
      title: `Quote for ${customerName}`,
      customer_name: customerName,
      customer_email: customerEmail || null,
      notes: notes || null,
      status: "sent",
      subtotal,
      tax_amount: 0,
      total: subtotal,
    })
    .select("id, public_token")
    .single();

  if (quoteError || !quote) {
    return { error: "We could not create the quote. Please try again." };
  }

  const { error: itemsError } = await supabase.from("quote_items").insert(
    items.map((item) => ({
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
