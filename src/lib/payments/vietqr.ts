// NAPAS account-transfer payload: EMV TLV, currency 704, CRC-16/CCITT-FALSE.
// Format reference: https://github.com/subiz/vietqr/blob/master/vietqr.go
export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string) {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("QR field is too long.");
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

export function createVietQrPayload(input: {
  bankBin: string;
  accountNumber: string;
  amount: number;
  reference: string;
}) {
  if (
    !/^\d{6}$/.test(input.bankBin) ||
    !/^[A-Za-z0-9]{1,19}$/.test(input.accountNumber)
  ) {
    throw new Error("Invalid receiving account.");
  }
  if (
    !Number.isSafeInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > 9999999999999
  ) {
    throw new Error("Payment amount must be a positive whole VND amount.");
  }
  if (!/^[A-Z0-9 ]{1,25}$/.test(input.reference))
    throw new Error("Invalid transfer reference.");
  const beneficiary =
    field("00", input.bankBin) + field("01", input.accountNumber);
  const merchant =
    field("00", "A000000727") +
    field("01", beneficiary) +
    field("02", "QRIBFTTA");
  const payload =
    field("00", "01") +
    field("01", "12") +
    field("38", merchant) +
    field("53", "704") +
    field("54", String(input.amount)) +
    field("58", "VN") +
    field("62", field("08", input.reference)) +
    "6304";
  return payload + crc16(payload);
}
