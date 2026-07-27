"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssignReviewers } from "@/features/reviews/hooks";
import {
  deadlineAfterDays,
  toDateTimeLocal,
} from "@/features/reviews/review-deadlines";
import { ApiError } from "@/lib/api/errors";

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

const invitationSchema = z
  .object({
    responseDeadline: z.string().min(1, "Select a response deadline."),
    reviewDeadline: z.string().min(1, "Select a review deadline."),
  })
  .superRefine((values, context) => {
    const responseDate = new Date(values.responseDeadline);
    const reviewDate = new Date(values.reviewDeadline);
    const now = new Date();

    if (!Number.isFinite(responseDate.getTime())) {
      context.addIssue({
        code: "custom",
        path: ["responseDeadline"],
        message: "Provide a valid invitation response deadline.",
      });
    } else if (responseDate <= now) {
      context.addIssue({
        code: "custom",
        path: ["responseDeadline"],
        message: "The invitation response deadline must be in the future.",
      });
    }

    if (!Number.isFinite(reviewDate.getTime())) {
      context.addIssue({
        code: "custom",
        path: ["reviewDeadline"],
        message: "Provide a valid review submission deadline.",
      });
    } else if (
      Number.isFinite(responseDate.getTime()) &&
      reviewDate <= responseDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["reviewDeadline"],
        message: "The review deadline must be later than the response deadline.",
      });
    }
  });

type InvitationFormValues = z.infer<typeof invitationSchema>;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The reviewer invitations could not be sent.";
}

function getApiDetails(error: unknown) {
  if (!(error instanceof ApiError) || !error.details) {
    return {};
  }

  return error.details as Record<string, unknown>;
}

function detailMessage(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }

  return typeof value === "string" ? value : undefined;
}

export function ReviewerInvitationBatchForm({
  submissionId,
  reviewers,
  onCancel,
  onAssigned,
}: ReviewerInvitationBatchFormProps) {
  const assignReviewers = useAssignReviewers();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      responseDeadline: deadlineAfterDays(3),
      reviewDeadline: deadlineAfterDays(14),
    },
  });

  const responseDeadlineId = `batch-response-deadline-${submissionId}`;
  const reviewDeadlineId = `batch-review-deadline-${submissionId}`;

  const submitInvitations = handleSubmit(async (values) => {
    if (reviewers.length === 0) {
      return;
    }

    try {
      const response = await assignReviewers.mutateAsync({
        submissionId,
        payload: {
          reviewer_ids: reviewers.map((reviewer) => reviewer.id),
          response_deadline: new Date(values.responseDeadline).toISOString(),
          review_deadline: new Date(values.reviewDeadline).toISOString(),
        },
      });
      onAssigned(response.count);
    } catch (error) {
      const details = getApiDetails(error);
      const responseError = detailMessage(details.response_deadline);
      const reviewError = detailMessage(details.review_deadline);

      if (responseError) {
        setError("responseDeadline", {
          type: "server",
          message: responseError,
        });
      }

      if (reviewError) {
        setError("reviewDeadline", {
          type: "server",
          message: reviewError,
        });
      }
    }
  });

  const reviewerError = detailMessage(
    getApiDetails(assignReviewers.error).reviewer_ids,
  );
  const showGeneralError =
    assignReviewers.isError &&
    !reviewerError &&
    !errors.responseDeadline &&
    !errors.reviewDeadline;

  return (
    <form
      className="space-y-5 rounded-lg border bg-muted/20 p-4"
      onSubmit={submitInvitations}
      noValidate
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

      {showGeneralError || reviewerError ? (
        <Alert variant="destructive">
          <AlertTitle>Invitations not sent</AlertTitle>
          <AlertDescription>
            {reviewerError ?? getErrorMessage(assignReviewers.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      <ul className="space-y-2">
        {reviewers.map((reviewer) => (
          <li
            key={reviewer.id}
            className="rounded-md border bg-background px-3 py-2"
          >
            <p className="text-sm font-medium" dir="auto">
              {reviewer.fullName}
            </p>
            <p className="text-xs text-muted-foreground">
              {reviewer.email}
              {reviewer.affiliation ? ` · ${reviewer.affiliation}` : ""}
            </p>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          htmlFor={responseDeadlineId}
          label="Invitation response deadline"
          description="Every selected reviewer must accept or decline by this time."
          error={errors.responseDeadline?.message}
          required
        >
          <Input
            id={responseDeadlineId}
            type="datetime-local"
            min={toDateTimeLocal(new Date())}
            disabled={assignReviewers.isPending}
            aria-invalid={Boolean(errors.responseDeadline)}
            aria-describedby={getFormFieldDescription({
              id: responseDeadlineId,
              hasDescription: true,
              hasError: Boolean(errors.responseDeadline),
            })}
            {...register("responseDeadline")}
          />
        </FormField>

        <FormField
          htmlFor={reviewDeadlineId}
          label="Review submission deadline"
          description="This deadline applies after each invitation is accepted."
          error={errors.reviewDeadline?.message}
          required
        >
          <Input
            id={reviewDeadlineId}
            type="datetime-local"
            disabled={assignReviewers.isPending}
            aria-invalid={Boolean(errors.reviewDeadline)}
            aria-describedby={getFormFieldDescription({
              id: reviewDeadlineId,
              hasDescription: true,
              hasError: Boolean(errors.reviewDeadline),
            })}
            {...register("reviewDeadline")}
          />
        </FormField>
      </div>

      <Alert>
        <AlertTitle>Atomic invitation batch</AlertTitle>
        <AlertDescription>
          If any selected reviewer is no longer eligible, no invitations will
          be created. Duplicate and conflicted reviewers remain blocked by the
          backend.
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
