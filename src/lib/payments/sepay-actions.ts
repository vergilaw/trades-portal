"use server";
import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSePaySecret } from "./sepay-crypto";
import { uuidPattern } from "./sepay";

export type SePayActionState = {
  error?: string;
  message?: string;
  secret?: string;
  connectionId?: string;
};
export async function configureSePayAction(
  _state: SePayActionState,
  form: FormData,
): Promise<SePayActionState> {
  const client = await createClient();
  const { data, error: authError } = await client.auth.getClaims();
  if (authError || !data?.claims.sub) redirect("/login");
  const owner = data.claims.sub;
  if (
    !process.env.APP_URL ||
    !process.env.SUPABASE_SECRET_KEY ||
    !process.env.SEPAY_ENCRYPTION_KEY
  )
    return {
      error: "Automatic reconciliation is not configured on this server.",
    };
  try {
    const admin = createAdminClient();
    if (form.get("intent") === "disconnect") {
      const { error } = await admin.rpc("disconnect_sepay_connection", {
        p_owner_id: owner,
      });
      if (error) return { error: "Could not disconnect SePay. Try again." };
      revalidatePath("/settings");
      return {
        message: "SePay disconnected. Transaction history is retained.",
      };
    }
    const accountIds = form
      .getAll("accountId")
      .filter((id): id is string => typeof id === "string");
    if (
      !accountIds.length ||
      accountIds.length > 10 ||
      new Set(accountIds).size !== accountIds.length ||
      !accountIds.every((id) => uuidPattern.test(id))
    )
      return { error: "Choose a receiving account." };
    const { data: existing, error: existingError } = await client
      .from("sepay_connections")
      .select("id")
      .maybeSingle();
    if (existingError) throw existingError;
    const id = existing?.id ?? randomUUID();
    const secret = randomBytes(32).toString("hex");
    const encrypted = encryptSePaySecret(
      secret,
      id,
      owner,
      process.env.SEPAY_ENCRYPTION_KEY,
    );
    const { error } = await admin.rpc("configure_sepay_connection", {
      p_owner_id: owner,
      p_id: id,
      p_secret: encrypted,
      p_account_ids: accountIds,
    });
    if (error) throw error;
    revalidatePath("/settings");
    return {
      secret,
      connectionId: id,
      message:
        "SePay connection saved. Configure your webhook with the new key.",
    };
  } catch {
    return {
      error:
        "Could not configure SePay. Check your selected accounts and try again.",
    };
  }
}
