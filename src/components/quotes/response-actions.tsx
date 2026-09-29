"use client";

import { useFormStatus } from "react-dom";
import { Check, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { respondToQuoteAction } from "@/lib/quotes/actions";

function ResponseButton({
  decision,
}: {
  decision: "approved" | "rejected";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={decision === "approved" ? "primary" : "secondary"}
      disabled={pending}
      className="w-full"
    >
      {!pending &&
        (decision === "approved" ? (
          <Check aria-hidden="true" weight="bold" />
        ) : (
          <X aria-hidden="true" weight="bold" />
        ))}
      {pending
        ? "Saving response..."
        : decision === "approved"
          ? "Approve quote"
          : "Reject"}
    </Button>
  );
}

export function ResponseActions({ token }: { token: string }) {
  const approveAction = respondToQuoteAction.bind(null, token, "approved");
  const rejectAction = respondToQuoteAction.bind(null, token, "rejected");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <form action={approveAction}>
        <ResponseButton decision="approved" />
      </form>
      <form action={rejectAction}>
        <ResponseButton decision="rejected" />
      </form>
    </div>
  );
}
