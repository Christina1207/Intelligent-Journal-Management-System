"use client";

import * as React from "react";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
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
import type { ReviewerApplication } from "@/features/reviewer-applications/types";

export type ReviewerApplicationDecisionMode = "approve" | "reject";

type ReviewerApplicationDecisionDialogProps = {
  application: ReviewerApplication;
  mode: ReviewerApplicationDecisionMode;
  isPending: boolean;
  apiError: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (decisionNote: string) => void;
};

function getApplicantName(application: ReviewerApplication) {
  return (
    application.applicant.full_name.trim() || application.applicant.username
  );
}

export function ReviewerApplicationDecisionDialog({
  application,
  mode,
  isPending,
  apiError,
  onOpenChange,
  onConfirm,
}: ReviewerApplicationDecisionDialogProps) {
  const [decisionNote, setDecisionNote] = React.useState("");
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );

  const isApproval = mode === "approve";
  const applicantName = getApplicantName(application);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedNote = decisionNote.trim();

    if (!isApproval && !normalizedNote) {
      setValidationError(
        "Explain why the reviewer application is being rejected.",
      );
      return;
    }

    setValidationError(null);
    onConfirm(normalizedNote);
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isApproval
              ? `Approve ${applicantName}?`
              : `Reject ${applicantName}'s application?`}
          </DialogTitle>

          <DialogDescription>
            Application for the {application.section.name} section.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Notice
            tone={isApproval ? "success" : "destructive"}
            title={
              isApproval
                ? "Reviewer access will be granted"
                : "The applicant will be allowed to revise and resubmit"
            }
            description={
              isApproval
                ? "Approval grants the reviewer role, creates the reviewer profile, " +
                  "and limits reviewer eligibility to this section."
                : "The explanation will be visible to the applicant. " +
                  "Make it specific and constructive."
            }
          />

          {validationError || apiError ? (
            <Notice
              tone="destructive"
              title={
                isApproval
                  ? "Application could not be approved"
                  : "Application could not be rejected"
              }
              description={validationError ?? apiError}
            />
          ) : null}

          <div className="rounded-xl border border-border bg-muted/35 p-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Applicant
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {applicantName}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Section
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {application.section.name}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Affiliation
                </dt>
                <dd className="mt-1 text-foreground">
                  {application.applicant.affiliation}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium text-muted-foreground">
                  Country
                </dt>
                <dd className="mt-1 text-foreground">
                  {application.applicant.country}
                </dd>
              </div>
            </dl>
          </div>

          <FormField
            htmlFor="reviewer-application-decision-note"
            label={
              isApproval
                ? "Internal decision note"
                : "Explanation to the applicant"
            }
            description={
              isApproval
                ? "Optional note documenting why this applicant was approved."
                : "Required. Explain what should be improved before resubmission."
            }
            error={validationError}
            required={!isApproval}
          >
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {decisionNote.length}/2000
              </span>
            </div>

            <Textarea
              id="reviewer-application-decision-note"
              value={decisionNote}
              maxLength={2000}
              rows={6}
              disabled={isPending}
              aria-invalid={Boolean(validationError)}
              aria-describedby={getFormFieldDescription({
                id: "reviewer-application-decision-note",
                hasDescription: true,
                hasError: Boolean(validationError),
              })}
              placeholder={
                isApproval
                  ? "Optional editorial note..."
                  : "Explain the reason for rejection..."
              }
              onChange={(event) => {
                setDecisionNote(event.target.value);
                setValidationError(null);
              }}
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
              variant={isApproval ? "accent" : "destructive"}
              size="touch"
              disabled={isPending}
            >
              {isPending
                ? "Recording decision..."
                : isApproval
                  ? "Approve reviewer"
                  : "Reject application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
