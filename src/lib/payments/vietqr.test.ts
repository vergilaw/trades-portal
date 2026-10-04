import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { createVietQrPayload, crc16 } from "./vietqr";
import { normalizeHolderName, validateBankAccount } from "./banks";
import { parsePortalPayment } from "./portal";
import { paymentLabel } from "./types";

function fields(value: string) {
  const result: Record<string, string> = {};
  for (let index = 0; index < value.length;) {
    const tag = value.slice(index, index + 2);
    const length = Number(value.slice(index + 2, index + 4));
    assert.ok(Number.isFinite(length) && length > 0);
    result[tag] = value.slice(index + 4, index + 4 + length);
    assert.equal(result[tag].length, length);
    index += length + 4;
  }
  return result;
}
const input = {
  bankBin: "970436",
  accountNumber: "0011001234567",
  amount: 1500000,
  reference: "TP1234567890ABCDEF1234",
};

test("CRC matches the standard CCITT-FALSE check vector", () => {
  assert.equal(crc16("123456789"), "29B1");
});
test("QR round-trips through an independent scanner with exact bank, amount and content", () => {
  const payload = createVietQrPayload(input);
  const matrix = QRCode.create(payload, { errorCorrectionLevel: "M" }).modules;
  const scale = 6,
    border = 4,
    width = (matrix.size + border * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < matrix.size; y++)
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          const offset =
            (((y + border) * scale + dy) * width + (x + border) * scale + dx) *
            4;
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
        }
    }
  const scanned = jsQR(pixels, width, width);
  assert.equal(scanned?.data, payload);
  const outer = fields(scanned!.data);
  assert.equal(outer["00"], "01");
  assert.equal(outer["01"], "12");
  const merchant = fields(outer["38"]);
  assert.equal(merchant["00"], "A000000727");
  assert.equal(merchant["02"], "QRIBFTTA");
  const recipient = fields(merchant["01"]);
  assert.equal(recipient["00"], input.bankBin);
  assert.equal(recipient["01"], input.accountNumber);
  assert.equal(outer["53"], "704");
  assert.equal(outer["54"], String(input.amount));
  assert.equal(fields(outer["62"])["08"], input.reference);
  assert.equal(outer["63"], crc16(payload.slice(0, -4)));
});
test("Rejects unsafe QR values rather than truncating or rounding money", () => {
  for (const amount of [0, -1, 1.5, Infinity, NaN, 10000000000000]) {
    assert.throws(() => createVietQrPayload({ ...input, amount }));
  }
  assert.throws(() =>
    createVietQrPayload({ ...input, accountNumber: "123 456" }),
  );
  assert.throws(() =>
    createVietQrPayload({ ...input, accountNumber: "1".repeat(20) }),
  );
  assert.throws(() =>
    createVietQrPayload({ ...input, reference: "A".repeat(26) }),
  );
  assert.throws(() => createVietQrPayload({ ...input, reference: "Nội dung" }));
});
test("Preserves leading zeroes and normalizes Vietnamese holder names", () => {
  const holder = normalizeHolderName("  Đặng  Thị Ánh  ");
  assert.equal(holder, "DANG THI ANH");
  assert.equal(validateBankAccount("970436", "0011001234567", holder), null);
  assert.ok(validateBankAccount("000000", "123456", holder));
  assert.ok(validateBankAccount("970436", "123 456", holder));
});
test("Expired requests and customer reports never imply receipt", () => {
  const expires_at = "2026-10-01T00:00:00Z";
  assert.equal(
    paymentLabel({ status: "pending", expires_at }, Date.parse("2026-10-03")),
    "Expired",
  );
  assert.equal(
    paymentLabel({ status: "reported", expires_at }),
    "Awaiting confirmation",
  );
  assert.equal(
    paymentLabel({ status: "paid", expires_at }),
    "Payment received",
  );
  assert.equal(parsePortalPayment({ amount: 1.5 }), null);
  assert.equal(parsePortalPayment(null), null);
});
