"use client";
import { useI18n } from "@/components/i18n/provider";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FieldError, FormAlert } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfileAction,
  type ProfileActionState,
} from "@/lib/profile/actions";

type ProfileFormProps = {
  email?: string;
  profile: {
    fullName: string;
    businessName: string;
    phone: string;
  };
};

function SaveProfileButton() {
  const { t } = useI18n();

  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? t("Saving...") : t("Save profile")}
    </Button>
  );
}

export function ProfileForm({ email, profile }: ProfileFormProps) {
  const { t } = useI18n();

  const initialState: ProfileActionState = {};
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="businessName">
            {t("Business or tradesperson name")}
          </Label>
          <Input
            id="businessName"
            name="businessName"
            autoComplete="organization"
            defaultValue={profile.businessName}
            maxLength={100}
            autoFocus
            aria-invalid={Boolean(state.fieldErrors?.businessName)}
            aria-describedby={
              state.fieldErrors?.businessName
                ? "business-name-error"
                : undefined
            }
            className="mt-1.5"
          />
          <FieldError
            id="business-name-error"
            message={state.fieldErrors?.businessName}
          />
        </div>

        <div>
          <Label htmlFor="fullName">
            {t("Contact name")}{" "}
            <span className="font-normal text-zinc-500">{t("(optional)")}</span>
          </Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            defaultValue={profile.fullName}
            maxLength={100}
            aria-invalid={Boolean(state.fieldErrors?.fullName)}
            aria-describedby={
              state.fieldErrors?.fullName ? "full-name-error" : undefined
            }
            className="mt-1.5"
          />
          <FieldError
            id="full-name-error"
            message={state.fieldErrors?.fullName}
          />
        </div>

        <div>
          <Label htmlFor="phone">
            {t("Customer contact number")}{" "}
            <span className="font-normal text-zinc-500">{t("(optional)")}</span>
          </Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={profile.phone}
            maxLength={30}
            aria-invalid={Boolean(state.fieldErrors?.phone)}
            aria-describedby={
              state.fieldErrors?.phone ? "phone-error" : "phone-help"
            }
            className="mt-1.5"
            placeholder="+84 90 123 4567"
          />
          <p id="phone-help" className="mt-1.5 text-xs leading-5 text-zinc-500">
            {t(
              "Shown on customer quote portals so customers can contact you.",
            )}{" "}
          </p>
          <FieldError id="phone-error" message={state.fieldErrors?.phone} />
        </div>

        <div>
          <Label htmlFor="accountEmail">{t("Account email")}</Label>
          <Input
            id="accountEmail"
            value={email ?? ""}
            readOnly
            disabled
            className="mt-1.5"
          />
          <p className="mt-1.5 text-xs leading-5 text-zinc-500">
            {t("Used to sign in. Email changes are not available yet.")}{" "}
          </p>
        </div>
      </div>

      <div className="flex justify-end border-t border-zinc-200 pt-5">
        <SaveProfileButton />
      </div>
    </form>
  );
}
