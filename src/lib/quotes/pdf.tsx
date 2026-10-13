import { join } from "node:path";
import QRCode from "qrcode";
import type { PortalQuote } from "./portal";
import { appUrl } from "@/lib/app-url";
import { translate, intlLocale, type Locale } from "@/lib/i18n/shared";
import {
  formatMoney,
  formatQuoteDate,
  formatExpiryDate,
  shortQuoteId,
  quoteStatusLabels,
  isQuoteExpired,
} from "./format";

export type PdfQuote = Omit<PortalQuote, "photos" | "createdAt"> & {
  createdAt: string;
};

let fontsRegistered = false;

export async function renderQuotePdf(quote: PdfQuote, locale: Locale) {
  const {
    Document,
    Page,
    Text,
    View,
    Image: PdfImage,
    Link,
    Font,
    StyleSheet,
    renderToBuffer,
  } = await import("@react-pdf/renderer");
  if (!fontsRegistered) {
    Font.register({
      family: "Noto Sans",
      fonts: [
        {
          src: join(process.cwd(), "public/fonts/NotoSans-Regular.ttf"),
          fontWeight: 400,
        },
        {
          src: join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
          fontWeight: 700,
        },
      ],
    });
    Font.registerHyphenationCallback((word) =>
      word.length > 24 ? (word.match(/.{1,16}/gu) ?? [word]) : [word],
    );
    fontsRegistered = true;
  }

  const s = StyleSheet.create({
    page: {
      fontFamily: "Noto Sans",
      fontSize: 9,
      color: "#18181b",
      paddingTop: 226,
      paddingBottom: 58,
      paddingHorizontal: 36,
    },
    header: { position: "absolute", top: 30, left: 36, right: 36 },
    business: {
      fontSize: 10,
      fontWeight: 700,
      color: "#0d6f65",
      marginBottom: 6,
    },
    title: { fontSize: 17, fontWeight: 700, marginBottom: 7 },
    meta: { fontSize: 8, color: "#52525b", marginBottom: 3 },
    customer: { marginTop: 5, fontSize: 10 },
    tableHeader: {
      position: "absolute",
      top: 197,
      left: 36,
      right: 36,
      flexDirection: "row",
      borderBottom: "1pt solid #0d6f65",
      paddingBottom: 7,
      fontWeight: 700,
      fontSize: 8,
      color: "#0d6f65",
    },
    row: {
      flexDirection: "row",
      borderBottom: "0.5pt solid #e4e4e7",
      paddingVertical: 9,
    },
    description: { width: "47%", paddingRight: 12 },
    quantity: { width: "11%", textAlign: "right", paddingRight: 7 },
    price: { width: "21%", textAlign: "right", paddingRight: 7 },
    amount: { width: "21%", textAlign: "right" },
    totals: { marginTop: 15, marginLeft: "40%" },
    totalLine: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    grandTotal: {
      borderTop: "1pt solid #0d6f65",
      paddingTop: 7,
      marginTop: 3,
      fontWeight: 700,
      fontSize: 12,
    },
    notes: { marginTop: 18 },
    heading: { fontWeight: 700, marginBottom: 5 },
    portal: {
      marginTop: 22,
      paddingTop: 14,
      borderTop: "0.5pt solid #e4e4e7",
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    qr: { width: 82, height: 82 },
    portalText: { flex: 1, fontSize: 8, color: "#52525b" },
    link: { color: "#0d6f65", textDecoration: "none", fontSize: 7 },
    footer: {
      position: "absolute",
      top: 802,
      height: 14,
      left: 36,
      right: 36,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: "#71717a",
    },
  });

  const t = (key: string) => translate(key, locale);
  const portalUrl = appUrl(`/portal/${quote.token}?lang=${locale}`);
  const qr = await QRCode.toDataURL(portalUrl, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 400,
  });
  const number = new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 4,
  });
  const status =
    quote.status === "sent" && isQuoteExpired(quote.expiresAt)
      ? "Expired"
      : quoteStatusLabels[quote.status];
  const items = [...quote.items].sort((a, b) => a.position - b.position);
  return renderToBuffer(
    <Document
      title={`${t("Quote")} ${shortQuoteId(quote.id)}`}
      author={
        quote.contractor.businessName ||
        quote.contractor.name ||
        "Trades Portal"
      }
      language={locale}
    >
      <Page size="A4" style={s.page}>
        <View fixed style={s.header}>
          <Text style={s.business}>
            {quote.contractor.businessName ||
              quote.contractor.name ||
              "Trades Portal"}
          </Text>
          <Text style={s.title}>{quote.title}</Text>
          <Text style={s.meta}>
            {shortQuoteId(quote.id)} | {t(status)} | {t("Created on")}{" "}
            {formatQuoteDate(quote.createdAt, locale)}
          </Text>
          {quote.expiresAt && (
            <Text style={s.meta}>
              {t("Valid until")}: {formatExpiryDate(quote.expiresAt, locale)}
            </Text>
          )}
          {quote.contractor.phone && (
            <Text style={s.meta}>
              {t("Phone")}: {quote.contractor.phone}
            </Text>
          )}
          <Text style={s.customer}>
            {t("Prepared for")}: {quote.customerName}
          </Text>
        </View>
        <View fixed style={s.tableHeader}>
          <Text style={s.description}>{t("Description")}</Text>
          <Text style={s.quantity}>{t("Qty")}</Text>
          <Text style={s.price}>{t("Unit price")}</Text>
          <Text style={s.amount}>{t("Amount")}</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={s.row} minPresenceAhead={24}>
            <Text style={s.description}>{item.description}</Text>
            <Text style={s.quantity}>{number.format(item.quantity)}</Text>
            <Text style={s.price}>
              {formatMoney(item.unitPrice, quote.currency, locale)}
            </Text>
            <Text style={s.amount}>
              {formatMoney(
                Math.round(item.quantity * item.unitPrice * 100) / 100,
                quote.currency,
                locale,
              )}
            </Text>
          </View>
        ))}
        <View wrap={false} style={s.totals}>
          <View style={s.totalLine}>
            <Text>{t("Subtotal")}</Text>
            <Text>{formatMoney(quote.subtotal, quote.currency, locale)}</Text>
          </View>
          <View style={s.totalLine}>
            <Text>
              {t("Tax")} ({number.format(quote.taxRate)}%)
            </Text>
            <Text>{formatMoney(quote.taxAmount, quote.currency, locale)}</Text>
          </View>
          <View style={[s.totalLine, s.grandTotal]}>
            <Text>{t("Total")}</Text>
            <Text>{formatMoney(quote.total, quote.currency, locale)}</Text>
          </View>
        </View>
        {quote.notes && (
          <View style={s.notes}>
            <Text style={s.heading}>{t("Notes")}</Text>
            <Text>{quote.notes}</Text>
          </View>
        )}
        <View wrap={false} style={s.portal}>
          <PdfImage src={qr} style={s.qr} />
          <View style={s.portalText}>
            <Text style={s.heading}>{t("View your quote online")}</Text>
            <Text>
              {t(
                "Scan to review the latest quote and respond in the customer portal.",
              )}
            </Text>
            <Text>
              {t("This QR opens the quote portal. It is not a payment QR.")}
            </Text>
            <Link src={portalUrl} style={s.link}>
              {portalUrl}
            </Link>
          </View>
        </View>
        <View fixed style={s.footer}>
          <Text>Trades Portal | {shortQuoteId(quote.id)}</Text>
        </View>
        <Text
          fixed
          style={{
            position: "absolute",
            top: 802,
            left: 469,
            width: 90,
            height: 14,
            textAlign: "right",
            fontSize: 7,
            color: "#71717a",
          }}
          render={({ pageNumber, totalPages }) =>
            `${t("Page")} ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>,
  );
}
