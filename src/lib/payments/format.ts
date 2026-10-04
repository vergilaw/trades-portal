import { intlLocale, type Locale } from "@/lib/i18n/shared";
export function paymentDate(value: string, locale: Locale = "vi") {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
