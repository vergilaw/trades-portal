// Offline bank catalog. BINs verified against https://api.vietqr.io/v2/banks
// on 2026-10-03. No bank or QR service is contacted at runtime.
export const banks = [
  { bin: "970416", name: "ACB" },
  { bin: "970405", name: "Agribank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970452", name: "KienLongBank" },
  { bin: "970449", name: "LPBank" },
  { bin: "970422", name: "MBBank" },
  { bin: "970426", name: "MSB" },
  { bin: "970428", name: "NamABank" },
  { bin: "970419", name: "NCB" },
  { bin: "970448", name: "OCB" },
  { bin: "970412", name: "PVcomBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970429", name: "SCB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970443", name: "SHB" },
  { bin: "970424", name: "ShinhanBank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970427", name: "VietABank" },
  { bin: "970433", name: "VietBank" },
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970432", name: "VPBank" },
] as const;

export function bankName(bin: string) {
  return banks.find((bank) => bank.bin === bin)?.name ?? bin;
}

export function normalizeHolderName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function validateBankAccount(
  bin: string,
  number: string,
  holder: string,
) {
  if (!banks.some((bank) => bank.bin === bin))
    return "Choose a supported bank.";
  if (!/^[A-Za-z0-9]{1,19}$/.test(number)) {
    return "Account number must contain 1–19 letters or digits, without spaces.";
  }
  if (!/^[A-Z][A-Z ]{1,99}$/.test(holder)) {
    return "Enter the account holder's full name using letters and spaces.";
  }
  return null;
}
