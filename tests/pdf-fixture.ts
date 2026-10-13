import type { PdfQuote } from "../src/lib/quotes/pdf";

export function samplePdfQuote(long = false): PdfQuote {
  const count = long ? 20 : 3;
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: long
      ? "Thi công điện nước và lắp đặt thiết bị cho căn hộ - Báo giá vật tư cùng nhân công theo từng hạng mục đã thống nhất"
      : "Lắp đặt hệ thống điện căn hộ",
    customerName: "Nguyễn Thị Hương",
    currency: "VND",
    status: "sent",
    subtotal: count * 1500000,
    taxRate: 10,
    taxAmount: count * 150000,
    total: count * 1650000,
    createdAt: "2026-10-13T03:30:00Z",
    expiresAt: "2099-11-01T23:59:59Z",
    respondedAt: null,
    notes: long
      ? "Ghi chú nghiệm thu: vật tư phải đúng chủng loại, kiểm tra chống rò điện và bàn giao đầy đủ. ".repeat(
          22,
        )
      : "Bảo hành 12 tháng. Giá đã bao gồm vận chuyển và nhân công.",
    contractor: {
      name: "Trần Minh",
      businessName: "Điện Minh An",
      phone: "0901234567",
    },
    items: Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      description: long
        ? `${i + 1}. Vật tư và nhân công - kiểm tra hệ thống điện nước, đi dây âm tường, lắp đặt thiết bị và nghiệm thu. `
            .repeat(3)
            .slice(0, 295)
        : [
            "Dây điện và vật tư phụ",
            "Lắp đặt tủ điện, ổ cắm",
            "Nhân công thi công và kiểm tra",
          ][i],
      quantity: 1,
      unitPrice: 1500000,
      position: i,
    })),
  };
}
