import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import test from "node:test";
import { encryptSePaySecret, decryptSePaySecret } from "./sepay-crypto";
import {
  extractPaymentReference,
  parseSePayPayload,
  sepayBankBin,
  verifySePaySignature,
} from "./sepay";
import { handleSePayWebhook } from "./sepay-webhook";

const secret = "fixture-secret-only";
const reference = "TP0123456789ABCDEF0123";
const fixture = {
  id: 98765,
  gateway: "MBBank",
  accountNumber: "0012345678",
  transferAmount: 1500000,
  transferType: "in",
  content: `${reference} thanh toan`,
  referenceCode: "FT123",
  transactionDate: "2026-10-04 10:30:00",
  code: null,
};
function signedRequest(
  raw = JSON.stringify(fixture),
  timestamp = Math.floor(Date.now() / 1000).toString(),
  signingSecret = secret,
) {
  return new Request("https://portal.example/api/payments/sepay/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sepay-timestamp": timestamp,
      "x-sepay-signature": `sha256=${createHmac("sha256", signingSecret).update(`${timestamp}.${raw}`).digest("hex")}`,
    },
    body: raw,
  });
}
test("SePay HMAC authenticates original bytes and rejects stale, future and modified deliveries", () => {
  const now = Date.now();
  const ts = Math.floor(now / 1000).toString();
  const raw = JSON.stringify(fixture);
  const signature = `sha256=${createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`;
  assert.equal(verifySePaySignature(raw, signature, ts, secret, now), true);
  const unicode = Buffer.from(
    `\uFEFF${JSON.stringify({ ...fixture, content: "Thanh toán " + reference })}`,
  );
  const byteSignature = `sha256=${createHmac("sha256", secret).update(`${ts}.`).update(unicode).digest("hex")}`;
  assert.equal(
    verifySePaySignature(unicode, byteSignature, ts, secret, now),
    true,
  );
  assert.equal(
    verifySePaySignature(unicode.subarray(3), byteSignature, ts, secret, now),
    false,
  );
  for (const [body, header, timestamp, key] of [
    [`${raw} `, signature, ts, secret],
    [raw, signature, ts, "wrong"],
    [raw, "sha256=12", ts, secret],
    [raw, signature, String(Number(ts) - 301), secret],
    [raw, signature, String(Number(ts) + 301), secret],
    [raw, signature, "garbage", secret],
  ] as const)
    assert.equal(
      verifySePaySignature(body, header, timestamp, key, now),
      false,
    );
});
test("SePay payload uses whole VND and exact Vietnamese calendar time", () => {
  assert.equal(
    parseSePayPayload(JSON.stringify(fixture))?.transactionDate,
    "2026-10-04T03:30:00.000Z",
  );
  for (const overrides of [
    { id: 0 },
    { id: 1.5 },
    { transferAmount: 1.5 },
    { transferAmount: -1 },
    { transferAmount: 1e14 },
    { transferType: "unknown" },
    { transactionDate: "2026-02-30 12:00:00" },
    { transactionDate: "2026-10-04 25:00:00" },
    { accountNumber: null },
    { content: "x".repeat(10001) },
  ])
    assert.equal(
      parseSePayPayload(JSON.stringify({ ...fixture, ...overrides })),
      null,
    );
  assert.equal(parseSePayPayload("not JSON"), null);
  assert.equal(sepayBankBin("MB Bank"), "970422");
  assert.equal(sepayBankBin("VCB"), "970436");
  assert.equal(sepayBankBin("Unrecognized bank"), null);
});
test("Payment reference matching requires a complete, unambiguous token", () => {
  assert.deepEqual(
    extractPaymentReference(`memo ${reference.toLowerCase()} done`),
    { reference, reason: "valid" },
  );
  assert.equal(
    extractPaymentReference(`${reference} ${reference}`).reference,
    reference,
  );
  assert.equal(
    extractPaymentReference(`${reference} TPFFFFFFFFFFFFFFFFFFFF`).reason,
    "multiple_references",
  );
  for (const content of [
    "",
    reference.slice(0, -1),
    `${reference}A`,
    `A${reference}`,
    reference.replace("0123", "012 3"),
  ])
    assert.equal(extractPaymentReference(content).reason, "missing_reference");
});
test("Encrypted connection keys reject tampering, incorrect owners and encryption keys", () => {
  const key = randomBytes(32).toString("base64");
  const encrypted = encryptSePaySecret(secret, "connection", "owner", key);
  assert.ok(!encrypted.includes(secret));
  assert.equal(
    decryptSePaySecret(encrypted, "connection", "owner", key),
    secret,
  );
  assert.notEqual(
    encryptSePaySecret(secret, "connection", "owner", key),
    encrypted,
  );
  assert.throws(() => decryptSePaySecret(encrypted, "other", "owner", key));
  assert.throws(() =>
    decryptSePaySecret(encrypted, "connection", "other", key),
  );
  assert.throws(() =>
    decryptSePaySecret(
      encrypted,
      "connection",
      "owner",
      randomBytes(32).toString("base64"),
    ),
  );
  const edited = JSON.parse(encrypted);
  edited.body = Buffer.from("modified").toString("base64");
  assert.throws(() =>
    decryptSePaySecret(JSON.stringify(edited), "connection", "owner", key),
  );
  assert.throws(() =>
    encryptSePaySecret(secret, "connection", "owner", "bad-key"),
  );
});
test("Webhook acknowledges only authenticated durable processing and exposes no secrets", async () => {
  let processed = 0;
  const dependencies = {
    async connection() {
      return { id: "connection", owner_id: "owner", key_version: 2, secret };
    },
    async reconcile(input: {
      p_amount: number;
      p_reference: string | null;
      p_key_version: number;
    }) {
      assert.equal(input.p_amount, fixture.transferAmount);
      assert.equal(input.p_reference, reference);
      assert.equal(input.p_key_version, 2);
      processed++;
    },
  };
  const ok = await handleSePayWebhook(
    signedRequest(),
    "connection",
    dependencies,
  );
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { success: true });
  assert.equal(processed, 1);
  assert.equal(
    (
      await handleSePayWebhook(
        signedRequest(undefined, undefined, "wrong"),
        "connection",
        dependencies,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handleSePayWebhook(
        signedRequest("invalid JSON"),
        "connection",
        dependencies,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleSePayWebhook(signedRequest(), "connection", {
        ...dependencies,
        async connection() {
          return null;
        },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await handleSePayWebhook(signedRequest(), "connection", {
        ...dependencies,
        async reconcile() {
          throw new Error("database unreachable");
        },
      })
    ).status,
    503,
  );
  assert.equal(processed, 1);
  const retry = await handleSePayWebhook(
    signedRequest(),
    "connection",
    dependencies,
  );
  assert.equal(retry.status, 200);
  assert.equal(processed, 2);
  const bytes = new Uint8Array([0xff]);
  const ts = Math.floor(Date.now() / 1000).toString();
  const invalidUtf8 = new Request("https://portal.example/webhook", {
    method: "POST",
    body: bytes,
    headers: {
      "content-type": "application/json",
      "x-sepay-timestamp": ts,
      "x-sepay-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.`).update(bytes).digest("hex")}`,
    },
  });
  assert.equal(
    (await handleSePayWebhook(invalidUtf8, "connection", dependencies)).status,
    400,
  );
  assert.equal(processed, 2);
  assert.equal(
    (
      await handleSePayWebhook(
        signedRequest("x".repeat(65537)),
        "connection",
        dependencies,
      )
    ).status,
    413,
  );
});
