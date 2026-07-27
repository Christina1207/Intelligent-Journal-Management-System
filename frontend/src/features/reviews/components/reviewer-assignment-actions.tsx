"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Search,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useCancelReviewerAssignment,
  useExpireReviewerAssignment,
  useReplaceReviewerAssignment,
  useReviewerCandidates,
} from "@/features/reviews/hooks";
import {
  deadlineAfterDays,
  toDateTimeLocal,
  validateReviewDeadlines,
} from "@/features/reviews/review-deadlines";
import type { ReviewerAssignment } from "@/features/reviews/types";
import { ApiError } from "@/lib/api/errors";

type ReviewerAssignmentActionsProps = {
  assignment: ReviewerAssignment;
  submissionId: string;
  responseDeadlinePassed: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getApiFieldError(error: unknown, field: string) {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined;
  }

  const details = error.details as Record<string, unknown>;
  const value = details[field];

  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }

  return typeof value === "string" ? value : undefined;
}

function ExpireAssignmentDialog({
  assignment,
  submissionId,
}: Pick<ReviewerAssignmentActionsProps, "assignment" | "submissionId">) {
  const [open, setOpen] = useState(false);
  const expireAssignment = useExpireReviewerAssignment();

  const handleExpire = async () => {
    try {
      await expireAssignment.mutateAsync({
        assignmentId: assignment.id,
        submissionId,
      });
      setOpen(false);
    } catch {
      // The mutation error remains visible in the confirmation dialog.
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!expireAssignment.isPending) {
          setOpen(nextOpen);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        Mark expired
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark this invitation as expired?</DialogTitle>
          <DialogDescription>
            The reviewer will no longer be able to respond to this invitation.
            You can invite an eligible replacement afterward.
          </DialogDescription>
        </DialogHeader>

        {expireAssignment.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Invitation not expired</AlertTitle>
            <AlertDescription>
              {getErrorMessage(
                expireAssignment.error,
                "The invitation could not be marked as expired.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={expireAssignment.isPending}
              />
            }
          >
            Keep invitation
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={expireAssignment.isPending}
            onClick={handleExpire}
          >
            {expireAssignment.isPending
              ? "Expiring invitation…"
              : "Mark expired"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelAssignmentDialog({
  assignment,
  submissionId,
}: Pick<ReviewerAssignmentActionsProps, "assignment" | "submissionId">) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string>();
  const cancelAssignment = useCancelReviewerAssignment();
  const fieldId = `cancel-assignment-reason-${assignment.id}`;

  const handleCancel = async () => {
    const normalizedReason = reason.trim();

    if (normalizedReason.length < 10) {
      setValidationError(
        "Explain the operational reason in at least 10 characters.",
      );
      return;
    }

    setValidationError(undefined);

    try {
      await cancelAssignment.mutateAsync({
        assignmentId: assignment.id,
        submissionId,
        payload: { reason: normalizedReason },
      });
      setOpen(false);
      setReason("");
    } catch {
      // The normalized API error remains visible in the dialog.
    }
  };

  const apiFieldError = getApiFieldError(cancelAssignment.error, "reason");
  const error = validationError ?? apiFieldError;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!cancelAssignment.isPending) {
          setOpen(nextOpen);
          if (!nextOpen) {
            setValidationError(undefined);
            cancelAssignment.reset();
          }
        }
      }}
    >
      <DialogTrigger
        render={<Button type="button" size="sm" variant="outline" />}
      >
        Cancel assignment
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel this reviewer assignment?</DialogTitle>
          <DialogDescription>
            This closes the current-round assignment without deleting its
            history. A submitted review can never be cancelled.
          </DialogDescription>
        </DialogHeader>

        {cancelAssignment.isError && !apiFieldError ? (
          <Alert variant="destructive">
            <AlertTitle>Assignment not cancelled</AlertTitle>
            <AlertDescription>
              {getErrorMessage(
                cancelAssignment.error,
                "The reviewer assignment could not be cancelled.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField
          htmlFor={fieldId}
          label="Internal cancellation reason"
          description="This reason is retained in editorial assignment history."
          error={error}
          required
        >
          <Textarea
            id={fieldId}
            dir="auto"
            value={reason}
            rows={5}
            maxLength={2000}
            disabled={cancelAssignment.isPending}
            aria-invalid={Boolean(error)}
            aria-describedby={getFormFieldDescription({
              id: fieldId,
              hasDescription: true,
              hasError: Boolean(error),
            })}
            onChange={(event) => {
              setReason(event.target.value);
              setValidationError(undefined);
            }}
          />
        </FormField>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={cancelAssignment.isPending}
              />
            }
          >
            Keep assignment
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={cancelAssignment.isPending}
            onClick={handleCancel}
          >
            <UserRoundX aria-hidden="true" />
            {cancelAssignment.isPending
              ? "Cancelling assignment…"
              : "Cancel assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceAssignmentDialog({
  assignment,
  submissionId,
}: Pick<ReviewerAssignmentActionsProps, "assignment" | "submissionId">) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [reason, setReason] = useState("");
  const [responseDeadline, setResponseDeadline] = useState(() =>
    deadlineAfterDays(3),
  );
  const [reviewDeadline, setReviewDeadline] = useState(() =>
    deadlineAfterDays(14),
  );
  const [validationErrors, setValidationErrors] = useState<
    Partial<
      Record<
        "reviewerId" | "reason" | "responseDeadline" | "reviewDeadline",
        string
      >
    >
  >({});
  const replaceAssignment = useReplaceReviewerAssignment();
  const candidatesQuery = useReviewerCandidates({
    submissionId,
    search: debouncedSearch,
    limit: 50,
    enabled: open,
  });

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(searchInput.trim()),
      300,
    );

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const handleReplace = async () => {
    const deadlineErrors = validateReviewDeadlines(
      responseDeadline,
      reviewDeadline,
    );
    const nextErrors = {
      reviewerId: reviewerId ? undefined : "Select an eligible replacement.",
      reason:
        reason.trim().length >= 10
          ? undefined
          : "Explain the replacement in at least 10 characters.",
      ...deadlineErrors,
    };

    if (Object.values(nextErrors).some(Boolean)) {
      setValidationErrors(nextErrors);
      return;
    }

    setValidationErrors({});

    try {
      await replaceAssignment.mutateAsync({
        assignmentId: assignment.id,
        submissionId,
        payload: {
          reviewer_id: reviewerId,
          reason: reason.trim(),
          response_deadline: new Date(responseDeadline).toISOString(),
          review_deadline: new Date(reviewDeadline).toISOString(),
        },
      });
      setOpen(false);
    } catch {
      // The normalized API error remains visible in the dialog.
    }
  };

  const candidates = candidatesQuery.data?.candidates ?? [];
  const apiReviewerError = getApiFieldError(
    replaceAssignment.error,
    "reviewer_id",
  );
  const apiReasonError = getApiFieldError(replaceAssignment.error, "reason");
  const apiResponseError = getApiFieldError(
    replaceAssignment.error,
    "response_deadline",
  );
  const apiReviewError = getApiFieldError(
    replaceAssignment.error,
    "review_deadline",
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!replaceAssignment.isPending) {
          setOpen(nextOpen);
          if (!nextOpen) {
            setValidationErrors({});
            replaceAssignment.reset();
          }
        }
      }}
    >
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        Replace reviewer
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Replace this reviewer?</DialogTitle>
          <DialogDescription>
            The existing assignment will be cancelled and linked to a new
            invitation in one backend transaction. Its history is preserved.
          </DialogDescription>
        </DialogHeader>

        {replaceAssignment.isError &&
        !apiReviewerError &&
        !apiReasonError &&
        !apiResponseError &&
        !apiReviewError ? (
          <Alert variant="destructive">
            <AlertTitle>Reviewer not replaced</AlertTitle>
            <AlertDescription>
              {getErrorMessage(
                replaceAssignment.error,
                "The replacement could not be created.",
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              className="pl-9"
              aria-label="Search eligible replacement reviewers"
              placeholder="Search eligible reviewers"
              disabled={replaceAssignment.isPending}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>

          <FormField
            htmlFor={`replacement-reviewer-${assignment.id}`}
            label="Eligible replacement"
            description="Only backend-approved, available reviewers for this section are listed."
            error={validationErrors.reviewerId ?? apiReviewerError}
            required
          >
            <select
              id={`replacement-reviewer-${assignment.id}`}
              value={reviewerId}
              disabled={
                replaceAssignment.isPending || candidatesQuery.isPending
              }
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              onChange={(event) => {
                setReviewerId(event.target.value);
                setValidationErrors((current) => ({
                  ...current,
                  reviewerId: undefined,
                }));
              }}
            >
              <option value="">
                {candidatesQuery.isPending
                  ? "Loading eligible reviewers…"
                  : "Select a replacement reviewer"}
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.full_name} · {candidate.active_assignment_count} active
                </option>
              ))}
            </select>
          </FormField>

          {candidatesQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Eligible reviewers unavailable</AlertTitle>
              <AlertDescription>
                Retry the search before replacing this assignment.
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            htmlFor={`replacement-reason-${assignment.id}`}
            label="Internal replacement reason"
            error={validationErrors.reason ?? apiReasonError}
            required
          >
            <Textarea
              id={`replacement-reason-${assignment.id}`}
              dir="auto"
              value={reason}
              rows={4}
              maxLength={2000}
              disabled={replaceAssignment.isPending}
              onChange={(event) => {
                setReason(event.target.value);
                setValidationErrors((current) => ({
                  ...current,
                  reason: undefined,
                }));
              }}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              htmlFor={`replacement-response-deadline-${assignment.id}`}
              label="Response deadline"
              error={validationErrors.responseDeadline ?? apiResponseError}
              required
            >
              <Input
                id={`replacement-response-deadline-${assignment.id}`}
                type="datetime-local"
                min={toDateTimeLocal(new Date())}
                value={responseDeadline}
                disabled={replaceAssignment.isPending}
                onChange={(event) => setResponseDeadline(event.target.value)}
              />
            </FormField>

            <FormField
              htmlFor={`replacement-review-deadline-${assignment.id}`}
              label="Review deadline"
              error={validationErrors.reviewDeadline ?? apiReviewError}
              required
            >
              <Input
                id={`replacement-review-deadline-${assignment.id}`}
                type="datetime-local"
                min={responseDeadline}
                value={reviewDeadline}
                disabled={replaceAssignment.isPending}
                onChange={(event) => setReviewDeadline(event.target.value)}
              />
            </FormField>
          </div>

          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Responsibility changes immediately</AlertTitle>
            <AlertDescription>
              Confirm the replacement only after reviewing workload,
              eligibility, and potential conflicts.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={replaceAssignment.isPending}
              />
            }
          >
            Keep current reviewer
          </DialogClose>
          <Button
            type="button"
            disabled={
              replaceAssignment.isPending ||
              candidatesQuery.isPending ||
              candidatesQuery.isError
            }
            onClick={handleReplace}
          >
            <RefreshCw aria-hidden="true" />
            {replaceAssignment.isPending
              ? "Replacing reviewer…"
              : "Replace and invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewerAssignmentActions({
  assignment,
  submissionId,
  responseDeadlinePassed,
}: ReviewerAssignmentActionsProps) {
  const canManage =
    !assignment.review_submitted &&
    (assignment.status === "PENDING" || assignment.status === "ACCEPTED");

  if (!canManage) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">
      {assignment.status === "PENDING" && responseDeadlinePassed ? (
        <ExpireAssignmentDialog
          assignment={assignment}
          submissionId={submissionId}
        />
      ) : null}
      <ReplaceAssignmentDialog
        assignment={assignment}
        submissionId={submissionId}
      />
      <CancelAssignmentDialog
        assignment={assignment}
        submissionId={submissionId}
      />
    </div>
  );
}
