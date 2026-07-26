"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, LockKeyhole, Send, TriangleAlert } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitReview } from "@/features/reviews/hooks";
import type {
  ReviewRecommendation,
  ReviewerAssignment,
} from "@/features/reviews/types";
import { ApiError } from "@/lib/api/errors";

interface ReviewReportFormProps {
  assignment: ReviewerAssignment;
  onSubmitted?: () => void;
}

const RECOMMENDATIONS: Array<{
  value: ReviewRecommendation;
  label: string;
  description: string;
}> = [
  {
    value: "ACCEPT",
    label: "Accept",
    description: "The manuscript is suitable without a revision request.",
  },
  {
    value: "MINOR_REVISION",
    label: "Minor revision",
    description: "Limited, clearly scoped corrections are needed.",
  },
  {
    value: "MAJOR_REVISION",
    label: "Major revision",
    description: "Substantial changes and another review round are needed.",
  },
  {
    value: "REJECT",
    label: "Reject",
    description: "The manuscript should not proceed in its current form.",
  },
];

const reviewReportSchema = z
  .object({
    recommendation: z.union([
      z.enum(["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"]),
      z.literal(""),
    ]),
    commentsForAuthor: z.string(),
    commentsForEditor: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.recommendation) {
      context.addIssue({
        code: "custom",
        path: ["recommendation"],
        message: "Select a recommendation for the editor.",
      });
    }

    if (!values.commentsForAuthor.trim()) {
      context.addIssue({
        code: "custom",
        path: ["commentsForAuthor"],
        message: "Comments for the author are required.",
      });
    }
  });

type ReviewReportFormValues = z.infer<typeof reviewReportSchema>;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The review could not be submitted. Your draft is still available.";
}

function apiFieldMessage(error: unknown, field: string) {
  if (
    !(error instanceof ApiError) ||
    !error.details ||
    typeof error.details !== "object" ||
    Array.isArray(error.details)
  ) {
    return undefined;
  }

  const value = (error.details as Record<string, unknown>)[field];

  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }

  return typeof value === "string" ? value : undefined;
}

export function ReviewReportForm({
  assignment,
  onSubmitted,
}: ReviewReportFormProps) {
  const submitReview = useSubmitReview();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    recommendation: ReviewRecommendation;
    commentsForAuthor: string;
    commentsForEditor: string;
  }>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<ReviewReportFormValues>({
    resolver: zodResolver(reviewReportSchema),
    defaultValues: {
      recommendation: "",
      commentsForAuthor: "",
      commentsForEditor: "",
    },
  });

  const recommendation = useWatch({ control, name: "recommendation" });
  const authorComments = useWatch({ control, name: "commentsForAuthor" });
  const editorComments = useWatch({ control, name: "commentsForEditor" });
  const recommendationOption = RECOMMENDATIONS.find(
    (option) => option.value === recommendation,
  );
  const recommendationId = `recommendation-${assignment.id}`;
  const authorCommentsId = `author-comments-${assignment.id}`;
  const editorCommentsId = `editor-comments-${assignment.id}`;

  const openConfirmation = handleSubmit((values) => {
    if (!values.recommendation) {
      return;
    }

    setPendingValues({
      recommendation: values.recommendation,
      commentsForAuthor: values.commentsForAuthor.trim(),
      commentsForEditor: values.commentsForEditor.trim(),
    });
    submitReview.reset();
    setConfirmationOpen(true);
  });

  const confirmSubmission = async () => {
    if (!pendingValues) {
      return;
    }

    try {
      await submitReview.mutateAsync({
        assignmentId: assignment.id,
        payload: {
          recommendation: pendingValues.recommendation,
          comments_for_author: pendingValues.commentsForAuthor,
          comments_for_editor: pendingValues.commentsForEditor,
        },
      });
      setConfirmationOpen(false);
      onSubmitted?.();
    } catch (error) {
      const recommendationError = apiFieldMessage(error, "recommendation");
      const authorError = apiFieldMessage(error, "comments_for_author");
      const editorError = apiFieldMessage(error, "comments_for_editor");
      const hasFieldError = Boolean(
        recommendationError || authorError || editorError,
      );

      if (recommendationError) {
        setError("recommendation", {
          type: "server",
          message: recommendationError,
        });
      }

      if (authorError) {
        setError("commentsForAuthor", {
          type: "server",
          message: authorError,
        });
      }

      if (editorError) {
        setError("commentsForEditor", {
          type: "server",
          message: editorError,
        });
      }

      if (hasFieldError) {
        setConfirmationOpen(false);
      }
    }
  };

  return (
    <>
      <form
        className="space-y-6 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
        onSubmit={openConfirmation}
        noValidate
      >
        <div>
          <h2 className="text-lg font-semibold">Structured review report</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Your recommendation is advisory. The assigned editor makes the
            final decision after evaluating all available reports.
          </p>
        </div>

        {submitReview.isError && !confirmationOpen ? (
          <Alert variant="destructive">
            <AlertTitle>Review not submitted</AlertTitle>
            <AlertDescription>
              {getErrorMessage(submitReview.error)} Your entered comments have
              been preserved.
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField
          htmlFor={recommendationId}
          label="Recommendation to the editor"
          description={recommendationOption?.description}
          error={errors.recommendation?.message}
          required
        >
          <select
            id={recommendationId}
            disabled={submitReview.isPending}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={Boolean(errors.recommendation)}
            aria-describedby={getFormFieldDescription({
              id: recommendationId,
              hasDescription: Boolean(recommendationOption),
              hasError: Boolean(errors.recommendation),
            })}
            {...register("recommendation")}
          >
            <option value="">Select a recommendation</option>
            {RECOMMENDATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="rounded-xl border border-status-info-border bg-status-info-subtle/55 p-4">
          <div className="mb-4 flex items-start gap-2">
            <Eye
              className="mt-0.5 size-4 shrink-0 text-status-info-foreground"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-medium text-status-info-foreground">
                Author-facing comments
              </h3>
              <p className="mt-1 text-xs leading-5 text-status-info-foreground/85">
                These comments may be shared anonymously with the author. Do
                not identify yourself or include confidential editorial notes.
              </p>
            </div>
          </div>
          <FormField
            htmlFor={authorCommentsId}
            label="Comments for the author"
            error={errors.commentsForAuthor?.message}
            required
          >
            <Textarea
              id={authorCommentsId}
              rows={10}
              disabled={submitReview.isPending}
              placeholder="Describe the manuscript’s strengths, weaknesses, and specific changes required."
              aria-invalid={Boolean(errors.commentsForAuthor)}
              aria-describedby={getFormFieldDescription({
                id: authorCommentsId,
                hasError: Boolean(errors.commentsForAuthor),
              })}
              {...register("commentsForAuthor")}
            />
          </FormField>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-start gap-2">
            <LockKeyhole
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-medium">
                Confidential editor-only comments
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This optional content is visible to editors and is not exposed
                to the author.
              </p>
            </div>
          </div>
          <FormField
            htmlFor={editorCommentsId}
            label={
              <>
                Comments for the editor{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </>
            }
            error={errors.commentsForEditor?.message}
          >
            <Textarea
              id={editorCommentsId}
              rows={6}
              disabled={submitReview.isPending}
              placeholder="Add confidential concerns or editorial guidance."
              aria-invalid={Boolean(errors.commentsForEditor)}
              aria-describedby={getFormFieldDescription({
                id: editorCommentsId,
                hasError: Boolean(errors.commentsForEditor),
              })}
              {...register("commentsForEditor")}
            />
          </FormField>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="touch"
            disabled={submitReview.isPending}
          >
            <Send aria-hidden="true" />
            Review final submission
          </Button>
        </div>
      </form>

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!submitReview.isPending) {
            setConfirmationOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit this review as final?</DialogTitle>
            <DialogDescription>
              Submitted reviews cannot be edited or submitted twice. Check the
              visibility of both comment fields before confirming.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid gap-3 rounded-lg border bg-muted/35 p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                Recommendation
              </dt>
              <dd className="mt-1 font-medium">
                {recommendationOption?.label ?? "Not selected"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Author-facing comments
              </dt>
              <dd className="mt-1 font-medium">
                {authorComments.trim().length} characters
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                Confidential comments
              </dt>
              <dd className="mt-1 font-medium">
                {editorComments.trim()
                  ? `${editorComments.trim().length} characters`
                  : "None"}
              </dd>
            </div>
          </dl>

          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Final and read-only after submission</AlertTitle>
            <AlertDescription>
              The author-facing comments may be shared anonymously. The
              confidential comments remain editor-only.
            </AlertDescription>
          </Alert>

          {submitReview.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Review not submitted</AlertTitle>
              <AlertDescription>
                {getErrorMessage(submitReview.error)} Your draft remains
                available when you return to the form.
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitReview.isPending}
                />
              }
            >
              Return to review
            </DialogClose>
            <Button
              type="button"
              disabled={submitReview.isPending}
              onClick={confirmSubmission}
            >
              {submitReview.isPending
                ? "Submitting final review…"
                : "Confirm final submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
