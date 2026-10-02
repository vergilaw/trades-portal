"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Partial<
    Record<"fullName" | "businessName" | "phone", string>
  >;
};

const phonePattern = /^[0-9+().\-\s]{7,30}$/;

function fieldValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfileAction(
  _previousState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const fullName = fieldValue(formData, "fullName");
  const businessName = fieldValue(formData, "businessName");
  const phone = fieldValue(formData, "phone");
  const fieldErrors: ProfileActionState["fieldErrors"] = {};

  if (fullName.length > 100) {
    fieldErrors.fullName = "Name must be 100 characters or fewer.";
  }
  if (businessName.length > 100) {
    fieldErrors.businessName = "Business name must be 100 characters or fewer.";
  }
  if (!fullName && !businessName) {
    fieldErrors.businessName = "Enter a business or tradesperson name.";
  }
  if (phone && !phonePattern.test(phone)) {
    fieldErrors.phone = "Enter a valid phone number.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = authData?.claims.sub;

  if (authError || !userId) {
    redirect("/login");
  }

  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      business_name: businessName,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error || !updatedProfile) {
    return { error: "Your business profile could not be saved. Try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { message: "Business profile saved." };
}
