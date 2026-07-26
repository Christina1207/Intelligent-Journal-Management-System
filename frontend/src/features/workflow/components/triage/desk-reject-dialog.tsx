"use client";

import * as React from "react";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
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
  const [validationErrors, setValidationErrors] = React.useState<{
    reason?: string;
    authorMessage?: string;
  }>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = {
      reason: !reason ? "Select a desk-rejection reason." : undefined,
      authorMessage:
        authorMessage.trim().length < 20
          ? "The author-facing message must contain at least 20 characters."
          : undefined,
    };

    setValidationErrors(nextErrors);

    if (nextErrors.reason || nextErrors.authorMessage || !reason) {
      return;
    }

    onConfirm({
      reason_code: reason,
      author_message: authorMessage.trim(),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desk reject this manuscript?</DialogTitle>
          <DialogDescription>
            This records a final negative editorial decision for the current
            manuscript version.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Notice
            tone="destructive"
            title="The submission will leave the active workflow"
            description="The selected reason and message become part of the decision record. Only the author-facing message is shared with the author."
          />

          {validationErrors.reason ||
          validationErrors.authorMessage ||
          apiError ? (
            <Notice
              tone="destructive"
              title="Desk rejection could not be submitted"
              description={
                validationErrors.reason ??
                validationErrors.authorMessage ??
                apiError
              }
            />
          ) : null}

          <FormField
            htmlFor="desk-rejection-reason"
            label="Rejection reason"
            required
            error={validationErrors.reason}
          >
            <select
              id="desk-rejection-reason"
              value={reason}
              disabled={isPending}
              aria-invalid={Boolean(validationErrors.reason)}
              aria-describedby={getFormFieldDescription({
                id: "desk-rejection-reason",
                hasError: Boolean(validationErrors.reason),
              })}
              onChange={(event) => {
                setReason(event.target.value as TriageRejectionReason | "");
                setValidationErrors((current) => ({
                  ...current,
                  reason: undefined,
                }));
              }}
              className="block min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35"
            >
              <option value="">Select a reason</option>

              {rejectionReasons.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            htmlFor="desk-rejection-message"
            label="Message to the author"
            required
            description="Visible to the author. Do not include internal notes or confidential reviewer information."
            error={validationErrors.authorMessage}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {authorMessage.length}/5000
              </span>
            </div>

            <Textarea
              id="desk-rejection-message"
              value={authorMessage}
              maxLength={5000}
              disabled={isPending}
              aria-invalid={Boolean(validationErrors.authorMessage)}
              aria-describedby={getFormFieldDescription({
                id: "desk-rejection-message",
                hasDescription: true,
                hasError: Boolean(validationErrors.authorMessage),
              })}
              onChange={(event) => {
                setAuthorMessage(event.target.value);
                setValidationErrors((current) => ({
                  ...current,
                  authorMessage: undefined,
                }));
              }}
              placeholder="Explain the decision clearly and constructively."
              className="min-h-36"
              dir="auto"
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="destructive"
              size="touch"
              disabled={isPending}
            >
              {isPending ? "Recording decision…" : "Confirm desk rejection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
