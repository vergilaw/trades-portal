import { calculateQuoteTotals } from "@/lib/quotes/calculations";
import type { QuoteStatus } from "@/types";

type DemoItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type DemoQuote = {
  title: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  notes: string;
  status: QuoteStatus;
  taxRate: number;
  createdAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
  items: DemoItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
};

function shiftDays(from: Date, days: number, endOfDay = false) {
  const value = new Date(from);
  value.setUTCDate(value.getUTCDate() + days);
  if (endOfDay) value.setUTCHours(23, 59, 59, 999);
  return value.toISOString();
}

function quote(
  now: Date,
  input: Omit<DemoQuote, "subtotal" | "taxAmount" | "total" | "createdAt" | "expiresAt" | "respondedAt"> & {
    createdDaysAgo: number;
    expiresInDays?: number;
    respondedDaysAgo?: number;
  },
): DemoQuote {
  const totals = calculateQuoteTotals(input.items, input.taxRate);
  return {
    title: input.title,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    notes: input.notes,
    status: input.status,
    taxRate: input.taxRate,
    createdAt: shiftDays(now, -input.createdDaysAgo),
    expiresAt:
      input.expiresInDays === undefined
        ? null
        : shiftDays(now, input.expiresInDays, true),
    respondedAt:
      input.respondedDaysAgo === undefined
        ? null
        : shiftDays(now, -input.respondedDaysAgo),
    items: input.items,
    ...totals,
  };
}

export function buildDemoQuotes(now = new Date()): DemoQuote[] {
  return [
    quote(now, {
      title: "Replace main switchboard and safety test",
      customerName: "Nguyễn Minh Anh",
      customerEmail: "minhanh.nguyen@example.com",
      customerPhone: "090 312 4587",
      notes:
        "Includes isolation, new 18-way switchboard, RCBO protection, circuit labels and electrical safety test. Power will be off for approximately four hours.",
      status: "approved",
      taxRate: 10,
      createdDaysAgo: 42,
      expiresInDays: 14,
      respondedDaysAgo: 39,
      items: [
        { description: "18-way switchboard and RCBO hardware", quantity: 1, unitPrice: 8_600_000 },
        { description: "Licensed electrician labour", quantity: 8, unitPrice: 650_000 },
        { description: "Safety testing and compliance report", quantity: 1, unitPrice: 1_200_000 },
      ],
    }),
    quote(now, {
      title: "Service three split-system air conditioners",
      customerName: "Trần Quốc Bảo",
      customerEmail: "bao.tran@example.com",
      customerPhone: "093 845 2190",
      notes:
        "Deep clean indoor units, flush drain lines, check refrigerant pressure and test operating temperatures.",
      status: "approved",
      taxRate: 8,
      createdDaysAgo: 28,
      respondedDaysAgo: 25,
      items: [
        { description: "Deep clean split-system unit", quantity: 3, unitPrice: 850_000 },
        { description: "Drain line treatment", quantity: 3, unitPrice: 180_000 },
      ],
    }),
    quote(now, {
      title: "Bathroom leak repair and waterproofing",
      customerName: "Lê Thu Hà",
      customerEmail: "thuha.le@example.com",
      customerPhone: "098 770 3412",
      notes:
        "Remove damaged grout around shower, repair concealed pipe joint, waterproof affected area and reinstate tiles. Quote excludes replacement tiles if matching stock is unavailable.",
      status: "sent",
      taxRate: 10,
      createdDaysAgo: 5,
      expiresInDays: 9,
      items: [
        { description: "Leak detection and access", quantity: 1, unitPrice: 1_350_000 },
        { description: "Pipework repair", quantity: 1, unitPrice: 2_400_000 },
        { description: "Waterproofing and tile reinstatement", quantity: 1, unitPrice: 4_800_000 },
      ],
    }),
    quote(now, {
      title: "Sliding gate motor replacement",
      customerName: "Phạm Gia Huy",
      customerEmail: "giahuy.pham@example.com",
      customerPhone: "091 522 8064",
      notes:
        "Supply and install motor rated for the existing 600 kg gate. Includes two remotes, limit setup and safety reversal test.",
      status: "sent",
      taxRate: 10,
      createdDaysAgo: 2,
      expiresInDays: 19,
      items: [
        { description: "600 kg sliding gate motor kit", quantity: 1, unitPrice: 12_900_000 },
        { description: "Installation and commissioning", quantity: 1, unitPrice: 3_200_000 },
      ],
    }),
    quote(now, {
      title: "Kitchen sink and waste pipe upgrade",
      customerName: "Vũ Hoàng Nam",
      customerEmail: "hoangnam.vu@example.com",
      customerPhone: "097 603 1185",
      notes:
        "Replace double-bowl sink, mixer tap and undersink waste. Customer selected an alternative contractor before approval.",
      status: "rejected",
      taxRate: 8,
      createdDaysAgo: 18,
      respondedDaysAgo: 16,
      items: [
        { description: "Stainless double-bowl sink", quantity: 1, unitPrice: 3_600_000 },
        { description: "Pull-out mixer tap", quantity: 1, unitPrice: 2_200_000 },
        { description: "Plumbing labour and fittings", quantity: 1, unitPrice: 1_850_000 },
      ],
    }),
    quote(now, {
      title: "Office lighting conversion to LED",
      customerName: "Công ty An Phúc",
      customerEmail: "facilities@anphuc.example.com",
      customerPhone: "028 7302 4418",
      notes:
        "Replace existing fluorescent fittings after hours and dispose of lamps through an approved recycling provider.",
      status: "sent",
      taxRate: 10,
      createdDaysAgo: 35,
      expiresInDays: -7,
      items: [
        { description: "40 W LED panel light", quantity: 24, unitPrice: 780_000 },
        { description: "After-hours installation", quantity: 16, unitPrice: 520_000 },
        { description: "Lamp recycling fee", quantity: 1, unitPrice: 950_000 },
      ],
    }),
    quote(now, {
      title: "Install heat-pump water heater",
      customerName: "Đặng Ngọc Lan",
      customerEmail: "ngoclan.dang@example.com",
      customerPhone: "096 114 6720",
      notes:
        "Supply 200 L heat-pump unit, connect to existing hot-water lines and commission. Electrical circuit upgrade is included.",
      status: "sent",
      taxRate: 10,
      createdDaysAgo: 1,
      expiresInDays: 29,
      items: [
        { description: "200 L heat-pump water heater", quantity: 1, unitPrice: 34_500_000 },
        { description: "Plumbing and valves", quantity: 1, unitPrice: 4_600_000 },
        { description: "Dedicated electrical circuit", quantity: 1, unitPrice: 3_800_000 },
        { description: "Installation and commissioning", quantity: 1, unitPrice: 5_200_000 },
      ],
    }),
    quote(now, {
      title: "Warehouse CCTV expansion",
      customerName: "Kho vận Đông Nam",
      customerEmail: "ops@dongnam.example.com",
      customerPhone: "0274 381 9066",
      notes:
        "Add four 4K cameras to the existing recorder, extend network cabling and configure remote viewing for the operations manager.",
      status: "approved",
      taxRate: 10,
      createdDaysAgo: 60,
      respondedDaysAgo: 56,
      items: [
        { description: "4K PoE turret camera", quantity: 4, unitPrice: 3_150_000 },
        { description: "CAT6 cable and containment", quantity: 180, unitPrice: 28_000 },
        { description: "Installation and system configuration", quantity: 2, unitPrice: 3_400_000 },
      ],
    }),
  ];
}

export const demoQuoteTitles = buildDemoQuotes(new Date(0)).map(
  (item) => item.title,
);
