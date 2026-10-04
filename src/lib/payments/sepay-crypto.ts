import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(encoded: string) {
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== encoded)
    throw new Error(
      "SEPAY_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  return decoded;
}
export function encryptSePaySecret(
  secret: string,
  connectionId: string,
  ownerId: string,
  encodedKey: string,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(encodedKey), iv);
  cipher.setAAD(Buffer.from(`${connectionId}:${ownerId}`));
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    body: body.toString("base64"),
  });
}
export function decryptSePaySecret(
  encrypted: string,
  connectionId: string,
  ownerId: string,
  encodedKey: string,
) {
  const data = JSON.parse(encrypted);
  if (data.v !== 1) throw new Error("Unsupported encrypted key version.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(encodedKey),
    Buffer.from(data.iv, "base64"),
  );
  decipher.setAAD(Buffer.from(`${connectionId}:${ownerId}`));
  decipher.setAuthTag(Buffer.from(data.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data.body, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
