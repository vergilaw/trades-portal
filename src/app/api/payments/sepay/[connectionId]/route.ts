import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSePaySecret } from "@/lib/payments/sepay-crypto";
import { handleSePayWebhook } from "@/lib/payments/sepay-webhook";
import { uuidPattern } from "@/lib/payments/sepay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const { connectionId } = await params;
  if (!uuidPattern.test(connectionId))
    return Response.json({ success: false }, { status: 404 });
  return handleSePayWebhook(request, connectionId, {
    async connection(id) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("sepay_connections")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data?.is_active) return null;
      const { data: credential, error: secretError } = await admin
        .from("sepay_connection_secrets")
        .select("encrypted_secret")
        .eq("connection_id", id)
        .single();
      if (secretError) throw secretError;
      return {
        ...data,
        secret: decryptSePaySecret(
          credential.encrypted_secret,
          id,
          data.owner_id,
          process.env.SEPAY_ENCRYPTION_KEY ?? "",
        ),
      };
    },
    async reconcile(input) {
      const { error } = await createAdminClient().rpc(
        "reconcile_sepay_transaction",
        input,
      );
      if (error) throw error;
    },
  });
}
