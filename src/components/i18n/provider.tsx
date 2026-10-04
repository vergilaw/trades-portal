"use client";
import { createContext, useContext, useMemo } from "react";
import { createTranslator, translate, type Locale } from "@/lib/i18n/shared";
const Context = createContext<Locale>("vi");
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <Context.Provider value={locale}>{children}</Context.Provider>;
}
export function useI18n() {
  const locale = useContext(Context);
  return useMemo(
    () => ({
      locale,
      t: createTranslator(locale),
      text: (key: string, params?: Record<string, string | number>) =>
        translate(key, locale, params),
    }),
    [locale],
  );
}
