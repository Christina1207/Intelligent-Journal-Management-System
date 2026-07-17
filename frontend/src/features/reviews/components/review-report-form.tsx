"use client";

import { type FormEvent, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitReview } from "@/features/reviews/hooks";
import type {
  ReviewRecommendation,
  ReviewerAssignment,
} from "@/features/reviews/types";

interface ReviewReportFormProps {
  assignment: ReviewerAssignment;
  onCancel: () => void;
  onSubmitted: () => void;
}

const RECOMMENDATIONS: Array<{
  value: ReviewRecommendation;
  label: string;
}> = [
  { value: "ACCEPT", label: "Accept" },
  { value: "MINOR_REVISION", label: "Minor revision" },
  { value: "MAJOR_REVISION", label: "Major revision" },
  { value: "REJECT", label: "Reject" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The review could not be submitted. Please try again.";
}

export function ReviewReportForm({
  assignment,
  onCancel,
  onSubmitted,
}: ReviewReportFormProps) {
  const submitReview = useSubmitReview();

  const [recommendation, setRecommendation] = useState<
    ReviewRecommendation | ""
  >("");
  const [commentsForAuthor, setCommentsForAuthor] = useState("");
  const [commentsForEditor, setCommentsForEditor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!recommendation) {
      setValidationError("Select a recommendation for the editor.");
      return;
    }

    if (!commentsForAuthor.trim()) {
      setValidationError("Comments for the author are required.");
      return;
    }

    const confirmed = window.confirm(
      "Submit this review? Submitted reviews cannot be edited.",
    );

    if (!confirmed) {
      return;
    }

    submitReview.mutate(
      {
        assignmentId: assignment.id,
        payload: {
          recommendation,
          comments_for_author: commentsForAuthor.trim(),
          comments_for_editor: commentsForEditor.trim(),
        },
      },
      {
        onSuccess: onSubmitted,
      },
    );
  };

  const error = validationError
    ? validationError
    : submitReview.isError
      ? getErrorMessage(submitReview.error)
      : null;

  return (
    <form
      className="space-y-5 rounded-lg border bg-muted/20 p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-medium">Structured review report</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your recommendation is advisory. The section editor makes the final
          editorial decision.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Review not submitted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`recommendation-${assignment.id}`}>
          Recommendation to the editor
        </Label>
        <select
          id={`recommendation-${assignment.id}`}
          value={recommendation}
          disabled={submitReview.isPending}
          onChange={(event) =>
            setRecommendation(event.target.value as ReviewRecommendation | "")
          }
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Select a recommendation</option>
          {RECOMMENDATIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`author-comments-${assignment.id}`}>
          Comments for the author
        </Label>
        <Textarea
          id={`author-comments-${assignment.id}`}
          value={commentsForAuthor}
          disabled={submitReview.isPending}
          rows={8}
          placeholder="Describe the manuscript’s strengths, weaknesses, and specific changes required."
          onChange={(event) => setCommentsForAuthor(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          These comments may be shared anonymously with the author after the
          editor issues a decision.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`editor-comments-${assignment.id}`}>
          Confidential comments for the editor
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        </Label>
        <Textarea
          id={`editor-comments-${assignment.id}`}
          value={commentsForEditor}
          disabled={submitReview.isPending}
          rows={5}
          placeholder="Add confidential concerns or editorial guidance."
          onChange={(event) => setCommentsForEditor(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This content is editor-only and is never exposed to the author.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitReview.isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitReview.isPending}>
          {submitReview.isPending ? "Submitting…" : "Submit final review"}
        </Button>
      </div>
    </form>
  );
}
