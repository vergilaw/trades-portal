import { messages, type MessageKey } from "./messages";
export type Locale = "vi" | "en";
export const LOCALE_COOKIE = "trades-locale";
export function resolveLocale(
  query: string | null,
  cookie: string | undefined,
): Locale {
  return query === "vi" || query === "en"
    ? query
    : cookie === "en"
      ? "en"
      : "vi";
}
export function translate(
  key: string,
  locale: Locale,
  params: Record<string, string | number> = {},
) {
  const result =
    locale === "vi" && Object.hasOwn(messages, key)
      ? messages[key as MessageKey]
      : key;
  return result.replace(/\{(\w+)\}/g, (token, name) =>
    String(params[name] ?? token),
  );
}
export function createTranslator(locale: Locale) {
  return (key: MessageKey, params?: Record<string, string | number>) =>
    translate(key, locale, params);
}
export function intlLocale(locale: Locale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}
