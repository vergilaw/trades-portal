"use client";

import { Database } from "@phosphor-icons/react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { FormAlert } from "@/components/auth/form-fields";
import { Button } from "@/components/ui/button";
import {
  importDemoDataAction,
  type DemoImportState,
} from "@/lib/demo/actions";

function ImportButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <Database aria-hidden="true" size={18} weight="bold" />
      {pending ? "Loading demo workspace..." : "Load realistic demo data"}
    </Button>
  );
}

export function DemoDataImporter() {
  const initialState: DemoImportState = {};
  const [state, action] = useActionState(importDemoDataAction, initialState);

  return (
    <form action={action} className="space-y-4">
      {state.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state.message && <FormAlert tone="success">{state.message}</FormAlert>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="font-semibold text-zinc-950">Demo workspace</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Add eight realistic Vietnamese trade quotes across pending,
            approved, rejected and expired states. Running this again will not
            create duplicates.
          </p>
        </div>
        <ImportButton />
      </div>
    </form>
  );
}
