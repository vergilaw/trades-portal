import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/shared";

export async function proxy(request: NextRequest) {
  const locale = resolveLocale(
    request.nextUrl.searchParams.get("lang"),
    request.cookies.get(LOCALE_COOKIE)?.value,
  );
  request.headers.set("x-trades-locale", locale);
  const response = await updateSession(request);
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale)
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  return response;
}

export const config = {
  matcher: [
    "/((?!api/payments/sepay/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
