import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/shared";
import { I18nProvider } from "@/components/i18n/provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      default: "Trades Portal",
      template: "%s | Trades Portal",
    },
    description: translate(
      "Create and share professional trade quotes in minutes.",
      await getLocale(),
    ),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
