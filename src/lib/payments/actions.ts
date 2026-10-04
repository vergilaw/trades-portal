"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeHolderName, validateBankAccount } from "./banks";

export type PaymentActionState = { error?: string; message?: string };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function value(form: FormData, name: string) {
  const entry = form.get(name);
  return typeof entry === "string" ? entry.trim() : "";
}
async function ownerClient() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) redirect("/login");
  return client;
}
function refreshPayments(quoteId?: string) {
  revalidatePath("/payments");
  if (quoteId) revalidatePath(`/quote/${quoteId}`);
  revalidatePath("/portal/[token]", "page");
}

export async function saveBankAccountAction(
  _state: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const bin = value(form, "bankBin");
  const number = value(form, "accountNumber");
  const holder = normalizeHolderName(value(form, "holderName"));
  const invalid = validateBankAccount(bin, number, holder);
  if (invalid) return { error: invalid };
  if (form.get("verified") !== "on")
    return { error: "Confirm that the receiving account details are correct." };
  const client = await ownerClient();
  const { error } = await client.rpc("save_bank_account", {
    p_bin: bin,
    p_number: number,
    p_holder: holder,
  });
  if (error)
    return {
      error:
        "Could not save this account. Check the details and the 10-account limit, then try again.",
    };
  revalidatePath("/settings");
  revalidatePath("/quote/[id]", "page");
  return { message: "Receiving account saved." };
}

export async function toggleBankAccountAction(
  id: string,
  active: boolean,
  _state: PaymentActionState,
  _form: FormData,
): Promise<PaymentActionState> {
  void _form;
  if (!uuidPattern.test(id)) return { error: "Invalid account." };
  const client = await ownerClient();
  const { error } = await client.rpc("set_bank_account_active", {
    p_id: id,
    p_active: active,
  });
  if (error) return { error: "Could not update this account. Try again." };
  revalidatePath("/settings");
  revalidatePath("/quote/[id]", "page");
  return {
    message: active
      ? "Account enabled."
      : "Account disabled for new requests. Existing requests keep their receiving details.",
  };
}

export async function createQuotePaymentAction(
  quoteId: string,
  _state: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const accountId = value(form, "accountId");
  if (!uuidPattern.test(quoteId) || !uuidPattern.test(accountId))
    return { error: "Choose a receiving account." };
  const client = await ownerClient();
  const { error } = await client.rpc("create_quote_payment", {
    p_quote_id: quoteId,
    p_account_id: accountId,
  });
  if (error)
    return {
      error:
        "Could not create a payment request. Use an approved quote with a positive whole VND total and an active receiving account.",
    };
  refreshPayments(quoteId);
  return { message: "Payment request ready on the customer portal." };
}

export async function changePaymentAction(
  quoteId: string,
  paymentId: string,
  _state: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  const status = value(form, "status");
  const note = value(form, "note");
  if (
    !uuidPattern.test(quoteId) ||
    !uuidPattern.test(paymentId) ||
    !["paid", "pending", "cancelled"].includes(status)
  )
    return { error: "Invalid payment update." };
  if (note.length > 300)
    return { error: "Verification note must be 300 characters or fewer." };
  if (status === "paid" && (!note || form.get("verified") !== "on")) {
    return {
      error:
        "Check your bank statement, enter a bank reference or verification note, and confirm receipt.",
    };
  }
  const client = await ownerClient();
  const { error } = await client.rpc("change_quote_payment", {
    p_payment_id: paymentId,
    p_status: status,
    p_note: note || null,
  });
  if (error)
    return {
      error:
        "Could not update this payment. Refresh to check its current status.",
    };
  refreshPayments(quoteId);
  return {
    message:
      status === "paid"
        ? "Payment receipt confirmed."
        : "Payment request updated.",
  };
}

export async function reportPaymentAction(
  token: string,
  paymentId: string,
  _state: PaymentActionState,
  form: FormData,
): Promise<PaymentActionState> {
  if (!uuidPattern.test(token) || !uuidPattern.test(paymentId))
    return { error: "Invalid payment request." };
  if (form.get("transferred") !== "on")
    return { error: "Confirm you have completed the bank transfer first." };
  const client = await createClient();
  const { error } = await client.rpc("report_portal_payment", {
    p_token: token,
    p_payment_id: paymentId,
  });
  if (error)
    return {
      error:
        "This request is unavailable or expired. Refresh or contact the business.",
    };
  revalidatePath(`/portal/${token}`);
  revalidatePath("/quote/[id]", "page");
  revalidatePath("/payments");
  return {
    message:
      "Transfer reported. The business will check their bank statement and confirm receipt.",
  };
}
