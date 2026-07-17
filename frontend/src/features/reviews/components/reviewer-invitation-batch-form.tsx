"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAssignReviewers } from "@/features/reviews/hooks";

export type ReviewerSelection = {
  id: string;
  fullName: string;
  email: string;
  affiliation: string;
  keywords: string[];
};

interface ReviewerInvitationBatchFormProps {
  submissionId: string;
  reviewers: ReviewerSelection[];
  onCancel: () => void;
  onAssigned: (count: number) => void;
}

function toDateTimeLocal(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().slice(0, 16);
}

function deadlineAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(17, 0, 0, 0);

  return toDateTimeLocal(date);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The reviewer invitations could not be sent.";
}

export function ReviewerInvitationBatchForm({
  submissionId,
  reviewers,
  onCancel,
  onAssigned,
}: ReviewerInvitationBatchFormProps) {
  const assignReviewers = useAssignReviewers();

  const [responseDeadline, setResponseDeadline] = useState(() =>
    deadlineAfterDays(3),
  );
  const [reviewDeadline, setReviewDeadline] = useState(() =>
    deadlineAfterDays(14),
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (reviewers.length === 0) {
      setValidationError("Select at least one reviewer.");
      return;
    }

    const responseDate = new Date(responseDeadline);
    const reviewDate = new Date(reviewDeadline);
    const now = new Date();

    if (
      Number.isNaN(responseDate.getTime()) ||
      Number.isNaN(reviewDate.getTime())
    ) {
      setValidationError("Provide valid invitation and review deadlines.");
      return;
    }

    if (responseDate <= now) {
      setValidationError(
        "The invitation response deadline must be in the future.",
      );
      return;
    }

    if (reviewDate <= responseDate) {
      setValidationError(
        "The review deadline must be later than the response deadline.",
      );
      return;
    }

    assignReviewers.mutate(
      {
        submissionId,
        payload: {
          reviewer_ids: reviewers.map((reviewer) => reviewer.id),
          response_deadline: responseDate.toISOString(),
          review_deadline: reviewDate.toISOString(),
        },
      },
      {
        onSuccess: (response) => onAssigned(response.count),
      },
    );
  };

  const error = validationError
    ? validationError
    : assignReviewers.isError
      ? getErrorMessage(assignReviewers.error)
      : null;

  return (
    <form
      className="space-y-5 rounded-lg border bg-muted/20 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-medium">
          Invite {reviewers.length} reviewer
          {reviewers.length === 1 ? "" : "s"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          The same response and review deadlines will apply to every selected
          reviewer.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Invitations not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="space-y-2">
        {reviewers.map((reviewer) => (
          <li
            key={reviewer.id}
            className="rounded-md border bg-background px-3 py-2"
          >
            <p className="text-sm font-medium">{reviewer.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {reviewer.email}
              {reviewer.affiliation ? ` · ${reviewer.affiliation}` : ""}
            </p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="batch-response-deadline">
            Invitation response deadline
          </Label>
          <Input
            id="batch-response-deadline"
            type="datetime-local"
            min={toDateTimeLocal(new Date())}
            value={responseDeadline}
            disabled={assignReviewers.isPending}
            onChange={(event) => setResponseDeadline(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Every selected reviewer must accept or decline by this time.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch-review-deadline">
            Review submission deadline
          </Label>
          <Input
            id="batch-review-deadline"
            type="datetime-local"
            min={responseDeadline}
            value={reviewDeadline}
            disabled={assignReviewers.isPending}
            onChange={(event) => setReviewDeadline(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This deadline applies after each invitation is accepted.
          </p>
        </div>
      </div>

      <Alert>
        <AlertTitle>Atomic invitation batch</AlertTitle>
        <AlertDescription>
          If any selected reviewer is no longer eligible, no invitations will be
          created. Review the selection and retry.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={assignReviewers.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={assignReviewers.isPending || reviewers.length === 0}
        >
          {assignReviewers.isPending
            ? "Sending invitations…"
            : `Send ${reviewers.length} invitation${
                reviewers.length === 1 ? "" : "s"
              }`}
        </Button>
      </div>
    </form>
  );
}
