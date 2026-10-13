import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import { authDestination } from "@/lib/auth/recovery";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = authDestination(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(appUrl(destination));
    }
    console.error("Auth callback exchange failed", { code: error.code });
  }

  return NextResponse.redirect(
    appUrl(
      destination === "/reset-password"
        ? "/forgot-password?error=invalid_link"
        : "/login?error=confirmation_failed",
    ),
  );
}
