import { createHmac, timingSafeEqual } from "node:crypto";
import { banks } from "./banks";

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function verifySePaySignature(
  raw: string | Uint8Array,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  now = Date.now(),
) {
  if (
    !timestamp ||
    !/^\d{10}$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300 ||
    !signature ||
    !/^sha256=[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(raw)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}
function canonicalBank(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
export function sepayBankBin(gateway: string) {
  const aliases: Record<string, string> = {
    mb: "MBBank",
    vcb: "Vietcombank",
    icb: "VietinBank",
    tcb: "Techcombank",
    vpb: "VPBank",
    vib: "VIB",
    klb: "KienLongBank",
    lpbank: "LPBank",
    lienvietpostbank: "LPBank",
  };
  const key = canonicalBank(gateway);
  return (
    banks.find(
      (bank) =>
        canonicalBank(bank.name) === canonicalBank(aliases[key] ?? gateway),
    )?.bin ?? null
  );
}
export function extractPaymentReference(content: string) {
  const references = [
    ...content
      .toUpperCase()
      .matchAll(/(?<![A-Z0-9])TP[A-F0-9]{20}(?![A-Z0-9])/g),
  ].map((match) => match[0]);
  const unique = [...new Set(references)];
  return {
    reference: unique.length === 1 ? unique[0] : null,
    reason:
      unique.length === 1
        ? "valid"
        : unique.length
          ? "multiple_references"
          : "missing_reference",
  };
}
export type SePayPayload = {
  id: number;
  gateway: string;
  accountNumber: string;
  transferAmount: number;
  transferType: "in" | "out";
  content: string;
  referenceCode: string;
  transactionDate: string;
};
export function parseSePayPayload(raw: string): SePayPayload | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const p = data as Record<string, unknown>;
  if (
    !Number.isSafeInteger(p.id) ||
    Number(p.id) <= 0 ||
    !Number.isSafeInteger(p.transferAmount) ||
    Number(p.transferAmount) <= 0 ||
    Number(p.transferAmount) >= 1e14 ||
    !["in", "out"].includes(String(p.transferType))
  )
    return null;
  for (const [field, max] of [
    ["gateway", 100],
    ["accountNumber", 100],
    ["content", 10000],
    ["transactionDate", 19],
  ] as const) {
    if (
      typeof p[field] !== "string" ||
      (field !== "content" && !p[field].length) ||
      p[field].length > max
    )
      return null;
  }
  if (
    p.referenceCode !== undefined &&
    (typeof p.referenceCode !== "string" || p.referenceCode.length > 255)
  )
    return null;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(p.transactionDate)))
    return null;
  const date = new Date(`${String(p.transactionDate).replace(" ", "T")}+07:00`);
  if (!Number.isFinite(date.getTime())) return null;
  // Reject dates that JS would silently normalize (e.g. February 30).
  const local = new Date(date.getTime() + 7 * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  if (local !== p.transactionDate) return null;
  return {
    id: Number(p.id),
    gateway: String(p.gateway),
    accountNumber: String(p.accountNumber),
    content: String(p.content),
    transferType: p.transferType as "in" | "out",
    transferAmount: Number(p.transferAmount),
    referenceCode: String(p.referenceCode ?? ""),
    transactionDate: date.toISOString(),
  };
}
