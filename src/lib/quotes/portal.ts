import type { Json, QuotePhotoPhase, QuoteStatus } from "@/types";

export type PortalQuote = {
  id: string;
  token: string;
  title: string;
  customerName: string;
  currency: string;
  notes: string | null;
  status: QuoteStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  expiresAt: string | null;
  respondedAt: string | null;
  contractor: {
    name: string;
    businessName: string;
    phone: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    position: number;
  }>;
  photos: Array<{
    id: string;
    phase: QuotePhotoPhase;
    storagePath: string;
    width: number;
    height: number;
    position: number;
  }>;
};

type JsonObject = { [key: string]: Json | undefined };

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: Json | undefined): value is string {
  return typeof value === "string";
}

function isNumber(value: Json | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStatus(value: Json | undefined): value is QuoteStatus {
  return (
    value === "draft" ||
    value === "sent" ||
    value === "approved" ||
    value === "rejected"
  );
}

function isPhotoPhase(value: Json | undefined): value is QuotePhotoPhase {
  return value === "before" || value === "after";
}

export function parsePortalQuote(value: Json): PortalQuote | null {
  if (
    !isObject(value) ||
    !isObject(value.contractor) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.photos)
  ) {
    return null;
  }

  const contractor = value.contractor;
  const items = value.items.map((item) => {
    if (
      !isObject(item) ||
      !isString(item.id) ||
      !isString(item.description) ||
      !isNumber(item.quantity) ||
      !isNumber(item.unitPrice) ||
      !isNumber(item.position)
    ) {
      return null;
    }

    return {
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      position: item.position,
    };
  });
  const photos = value.photos.map((photo) => {
    if (
      !isObject(photo) ||
      !isString(photo.id) ||
      !isPhotoPhase(photo.phase) ||
      !isString(photo.storagePath) ||
      !isNumber(photo.width) ||
      !isNumber(photo.height) ||
      !isNumber(photo.position)
    ) {
      return null;
    }

    return {
      id: photo.id,
      phase: photo.phase,
      storagePath: photo.storagePath,
      width: photo.width,
      height: photo.height,
      position: photo.position,
    };
  });

  if (
    items.some((item) => item === null) ||
    photos.some((photo) => photo === null) ||
    !isString(value.id) ||
    !isString(value.token) ||
    !isString(value.title) ||
    !isString(value.customerName) ||
    !isString(value.currency) ||
    !(value.notes === null || isString(value.notes)) ||
    !isStatus(value.status) ||
    !isNumber(value.subtotal) ||
    !isNumber(value.taxRate) ||
    !isNumber(value.taxAmount) ||
    !isNumber(value.total) ||
    !(value.expiresAt === null || isString(value.expiresAt)) ||
    !(value.respondedAt === null || isString(value.respondedAt)) ||
    !isString(contractor.name) ||
    !isString(contractor.businessName) ||
    !(contractor.phone === null || isString(contractor.phone))
  ) {
    return null;
  }

  return {
    id: value.id,
    token: value.token,
    title: value.title,
    customerName: value.customerName,
    currency: value.currency,
    notes: value.notes,
    status: value.status,
    subtotal: value.subtotal,
    taxRate: value.taxRate,
    taxAmount: value.taxAmount,
    total: value.total,
    expiresAt: value.expiresAt,
    respondedAt: value.respondedAt,
    contractor: {
      name: contractor.name,
      businessName: contractor.businessName,
      phone: contractor.phone,
    },
    items: items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ),
    photos: photos.filter(
      (photo): photo is NonNullable<typeof photo> => photo !== null,
    ),
  };
}
