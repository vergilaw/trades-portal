export type PaymentStatus = "pending" | "reported" | "paid" | "cancelled";
export type BankAccount = {
  id: string;
  owner_id: string;
  bank_bin: string;
  account_number: string;
  holder_name: string;
  is_active: boolean;
  created_at: string;
};
export type PaymentRequest = {
  id: string;
  quote_id: string;
  owner_id: string;
  bank_account_id: string;
  bank_bin: string;
  account_number: string;
  holder_name: string;
  amount: number;
  currency: "VND";
  reference: string;
  status: PaymentStatus;
  expires_at: string;
  reported_at: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
  settlement_source: "manual" | "sepay" | null;
  settled_transaction_id: string | null;
};
export type PaymentEvent = {
  id: string;
  payment_id: string;
  owner_id: string;
  actor_id: string | null;
  actor_kind: "owner" | "customer" | "system";
  from_status: PaymentStatus | null;
  to_status: PaymentStatus;
  note: string | null;
  created_at: string;
};
export type SePayConnection = {
  id: string;
  owner_id: string;
  is_active: boolean;
  key_version: number;
  last_received_at: string | null;
  created_at: string;
  updated_at: string;
};
export type SePayTransaction = {
  id: string;
  owner_id: string;
  connection_id: string;
  provider_id: number;
  bank_bin: string | null;
  gateway: string;
  account_number: string;
  amount: number;
  transfer_type: "in" | "out";
  reference: string | null;
  content: string;
  bank_reference: string;
  transaction_at: string;
  payment_id: string | null;
  outcome: "matched" | "review" | "ignored";
  reason: string;
  received_at: string;
};

export function paymentLabel(
  payment: Pick<PaymentRequest, "status" | "expires_at">,
  now = Date.now(),
) {
  if (payment.status === "pending" && Date.parse(payment.expires_at) <= now)
    return "Expired";
  return {
    pending: "Awaiting transfer",
    reported: "Awaiting confirmation",
    paid: "Payment received",
    cancelled: "Cancelled",
  }[payment.status];
}
