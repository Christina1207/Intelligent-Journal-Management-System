"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type {
  DeskRejectPayload,
  TriageRejectionReason,
} from "@/features/workflow/types";

const rejectionReasons: Array<{
  value: TriageRejectionReason;
  label: string;
}> = [
  { value: "OUT_OF_SCOPE", label: "Outside journal or section scope" },
  { value: "INCOMPLETE", label: "Incomplete submission" },
  { value: "QUALITY", label: "Insufficient submission quality" },
  { value: "GUIDELINES", label: "Submission guidelines not followed" },
  { value: "ETHICS", label: "Ethics or integrity concern" },
  { value: "OTHER", label: "Other" },
];

export function DeskRejectDialog({
  open,
  isPending,
  apiError,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  apiError: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: DeskRejectPayload) => void;
}) {
  const [reason, setReason] = React.useState<TriageRejectionReason | "">("");
  const [authorMessage, setAuthorMessage] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reason) {
      setValidationError("Select a desk-rejection reason.");
      return;
    }

    if (authorMessage.trim().length < 20) {
      setValidationError(
        "The author-facing message must contain at least 20 characters.",
      );
      return;
    }

    setValidationError(null);

    onConfirm({
      reason_code: reason,
      author_message: authorMessage.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desk reject manuscript</DialogTitle>
          <DialogDescription>
            This records a final rejection decision for the current manuscript
            version. The author-facing message will be included in the decision
            record.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {validationError || apiError ? (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {validationError ?? apiError}
            </div>
          ) : null}

          <div>
            <label
              htmlFor="desk-rejection-reason"
              className="text-sm font-medium text-slate-700"
            >
              Rejection reason
            </label>

            <select
              id="desk-rejection-reason"
              value={reason}
              disabled={isPending}
              onChange={(event) => {
                setReason(event.target.value as TriageRejectionReason | "");
                setValidationError(null);
              }}
              className="mt-2 block h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            >
              <option value="">Select a reason</option>

              {rejectionReasons.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="desk-rejection-message"
                className="text-sm font-medium text-slate-700"
              >
                Message to the author
              </label>

              <span className="text-xs text-slate-500">
                {authorMessage.length}/5000
              </span>
            </div>

            <Textarea
              id="desk-rejection-message"
              value={authorMessage}
              maxLength={5000}
              disabled={isPending}
              onChange={(event) => {
                setAuthorMessage(event.target.value);
                setValidationError(null);
              }}
              placeholder="Explain the decision clearly and constructively."
              className="mt-2 min-h-36"
            />

            <p className="mt-1 text-xs leading-5 text-slate-500">
              This message is visible to the author. Do not include internal
              notes or confidential reviewer information.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isPending ? "Rejecting manuscript..." : "Confirm desk rejection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
