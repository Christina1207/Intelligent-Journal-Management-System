"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAssignReviewer } from "@/features/reviews/hooks";

export type ReviewerSelection = {
  id: string;
  fullName: string;
  email: string;
  affiliation: string;
  keywords: string[];
};

interface ReviewerInvitationFormProps {
  submissionId: string;
  reviewer: ReviewerSelection;
  onCancel: () => void;
  onAssigned: (reviewerName: string) => void;
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

  return "The reviewer invitation could not be sent.";
}

export function ReviewerInvitationForm({
  submissionId,
  reviewer,
  onCancel,
  onAssigned,
}: ReviewerInvitationFormProps) {
  const assignReviewer = useAssignReviewer();

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

    assignReviewer.mutate(
      {
        submissionId,
        payload: {
          reviewer_id: reviewer.id,
          response_deadline: responseDate.toISOString(),
          review_deadline: reviewDate.toISOString(),
        },
      },
      {
        onSuccess: () => onAssigned(reviewer.fullName),
      },
    );
  };

  const error = validationError
    ? validationError
    : assignReviewer.isError
      ? getErrorMessage(assignReviewer.error)
      : null;

  return (
    <form
      className="space-y-4 rounded-lg border bg-muted/20 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-medium">Invite {reviewer.fullName}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {reviewer.email}
          {reviewer.affiliation ? ` · ${reviewer.affiliation}` : ""}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Invitation not sent</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`response-deadline-${reviewer.id}`}>
            Invitation response deadline
          </Label>
          <Input
            id={`response-deadline-${reviewer.id}`}
            type="datetime-local"
            min={toDateTimeLocal(new Date())}
            value={responseDeadline}
            disabled={assignReviewer.isPending}
            onChange={(event) => setResponseDeadline(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            The reviewer must accept or decline by this time.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`review-deadline-${reviewer.id}`}>
            Review submission deadline
          </Label>
          <Input
            id={`review-deadline-${reviewer.id}`}
            type="datetime-local"
            min={responseDeadline}
            value={reviewDeadline}
            disabled={assignReviewer.isPending}
            onChange={(event) => setReviewDeadline(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This deadline applies after the invitation is accepted.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={assignReviewer.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={assignReviewer.isPending}>
          {assignReviewer.isPending ? "Sending invitation…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}
