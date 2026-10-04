import {
  extractPaymentReference,
  parseSePayPayload,
  sepayBankBin,
  verifySePaySignature,
} from "./sepay";

type Connection = {
  id: string;
  owner_id: string;
  key_version: number;
  secret: string;
};
export type ReconciliationInput = {
  p_connection_id: string;
  p_key_version: number;
  p_provider_id: number;
  p_bank_bin: string | null;
  p_gateway: string;
  p_account_number: string;
  p_amount: number;
  p_transfer_type: string;
  p_reference: string | null;
  p_content: string;
  p_bank_reference: string;
  p_transaction_at: string;
  p_reference_reason: string;
};
export async function handleSePayWebhook(
  request: Request,
  connectionId: string,
  dependencies: {
    connection: (id: string) => Promise<Connection | null>;
    reconcile: (input: ReconciliationInput) => Promise<void>;
  },
) {
  const response = (status: number, success = false) =>
    Response.json({ success }, { status });
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return response(415);
  try {
    // Bound memory even when Content-Length is absent or misleading.
    const reader = request.body?.getReader();
    if (!reader) return response(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        return response(413);
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const connection = await dependencies.connection(connectionId);
    if (!connection) return response(404);
    if (
      !verifySePaySignature(
        bytes,
        request.headers.get("x-sepay-signature"),
        request.headers.get("x-sepay-timestamp"),
        connection.secret,
      )
    )
      return response(401);
    let raw: string;
    try {
      raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return response(400);
    }
    const payload = parseSePayPayload(raw);
    if (!payload) return response(400);
    const reference = extractPaymentReference(payload.content);
    await dependencies.reconcile({
      p_connection_id: connection.id,
      p_key_version: connection.key_version,
      p_provider_id: payload.id,
      p_bank_bin: sepayBankBin(payload.gateway),
      p_gateway: payload.gateway,
      p_account_number: payload.accountNumber,
      p_amount: payload.transferAmount,
      p_transfer_type: payload.transferType,
      p_reference: reference.reference,
      p_reference_reason: reference.reason,
      p_content: payload.content,
      p_bank_reference: payload.referenceCode,
      p_transaction_at: payload.transactionDate,
    });
    return response(200, true);
  } catch {
    // No credential, payload or bank data in server logs or error responses.
    return response(503);
  }
}
