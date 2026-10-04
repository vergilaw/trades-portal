import type { Json } from "@/types";
import type { PaymentRequest } from "./types";

export type PortalPayment = Pick<
  PaymentRequest,
  | "id"
  | "bank_bin"
  | "account_number"
  | "holder_name"
  | "amount"
  | "currency"
  | "reference"
  | "status"
  | "expires_at"
  | "reported_at"
  | "paid_at"
  | "settlement_source"
>;
export function parsePortalPayment(value: Json): PortalPayment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const key of [
    "id",
    "bank_bin",
    "account_number",
    "holder_name",
    "reference",
    "expires_at",
  ]) {
    if (typeof value[key] !== "string") return null;
  }
  if (
    typeof value.amount !== "number" ||
    !Number.isSafeInteger(value.amount) ||
    value.amount <= 0 ||
    value.currency !== "VND" ||
    !["pending", "reported", "paid", "cancelled"].includes(
      String(value.status),
    ) ||
    !(value.reported_at === null || typeof value.reported_at === "string") ||
    !(value.paid_at === null || typeof value.paid_at === "string")
  )
    return null;
  if (
    value.settlement_source !== null &&
    value.settlement_source !== undefined &&
    value.settlement_source !== "manual" &&
    value.settlement_source !== "sepay"
  )
    return null;
  return {
    ...value,
    settlement_source:
      value.settlement_source ?? (value.status === "paid" ? "manual" : null),
  } as PortalPayment;
}
