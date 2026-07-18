"use client";

import { type FormEvent, useState } from "react";
import { Gavel } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMakeEditorDecision } from "@/features/reviews/hooks";
import type { EditorDecision } from "@/features/reviews/types";
import { useRouter } from "next/navigation";
interface EditorDecisionFormProps {
  submissionId: string;
}

const DECISION_OPTIONS: Array<{
  value: EditorDecision;
  label: string;
  description: string;
}> = [
  {
    value: "ACCEPTED",
    label: "Accept",
    description:
      "Accept the current manuscript version and allow publication-draft creation.",
  },
  {
    value: "MINOR_REVISION",
    label: "Minor revision",
    description:
      "Request limited corrections without changing the manuscript’s central contribution.",
  },
  {
    value: "MAJOR_REVISION",
    label: "Major revision",
    description:
      "Request substantial changes followed by another review round.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    description:
      "End the editorial workflow without moving the manuscript to publishing.",
  },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The editorial decision could not be recorded.";
}

export function EditorDecisionForm({ submissionId }: EditorDecisionFormProps) {
  const makeDecision = useMakeEditorDecision();

  const [decision, setDecision] = useState<EditorDecision | "">("");
  const [decisionLetter, setDecisionLetter] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  const selectedOption = DECISION_OPTIONS.find(
    (option) => option.value === decision,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!decision) {
      setValidationError("Select an editorial decision.");
      return;
    }

    if (decision !== "ACCEPTED" && !decisionLetter.trim()) {
      setValidationError(
        "A decision letter is required for revision and rejection decisions.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Record the decision "${selectedOption?.label}"? This finalizes the decision for the current manuscript version.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await makeDecision.mutateAsync({
        submissionId,
        payload: {
          decision,
          decision_letter: decisionLetter.trim(),
        },
      });

      if (response.submission_status === "ACCEPTED") {
        router.replace(
          `/section-editor/submissions/${submissionId}/publishing`,
        );
      }
    } catch {
      // The mutation exposes the normalized error through makeDecision.error.
    }
  };

  const error = validationError
    ? validationError
    : makeDecision.isError
      ? getErrorMessage(makeDecision.error)
      : null;

  return (
    <form
      className="space-y-5 rounded-lg border border-primary/20 bg-primary/5 p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start gap-2">
        <Gavel className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div>
          <h3 className="font-medium">Record editorial decision</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review all submitted reports before finalizing the decision for this
            manuscript version.
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Decision not recorded</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`editor-decision-${submissionId}`}>Decision</Label>

        <select
          id={`editor-decision-${submissionId}`}
          value={decision}
          disabled={makeDecision.isPending}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          onChange={(event) =>
            setDecision(event.target.value as EditorDecision | "")
          }
        >
          <option value="">Select a decision</option>

          {DECISION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {selectedOption ? (
          <p className="text-xs text-muted-foreground">
            {selectedOption.description}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`decision-letter-${submissionId}`}>
          Decision letter
          {decision === "ACCEPTED" ? (
            <span className="ml-1 font-normal text-muted-foreground">
              (optional)
            </span>
          ) : null}
        </Label>

        <Textarea
          id={`decision-letter-${submissionId}`}
          value={decisionLetter}
          disabled={makeDecision.isPending}
          rows={7}
          placeholder={
            decision === "ACCEPTED"
              ? "Optionally add final editorial comments for the author."
              : "Explain the decision and provide clear, actionable revision or rejection reasons."
          }
          onChange={(event) => setDecisionLetter(event.target.value)}
        />

        <p className="text-xs text-muted-foreground">
          This letter is author-facing. Do not include confidential reviewer
          identities or editor-only comments.
        </p>
      </div>

      {decision === "ACCEPTED" ? (
        <Alert>
          <AlertTitle>Publishing handoff</AlertTitle>
          <AlertDescription>
            After acceptance succeeds, you will be redirected to create a
            publication draft from the accepted manuscript version. Draft
            creation does not publish the article.
          </AlertDescription>
        </Alert>
      ) : null}

      {decision === "MINOR_REVISION" || decision === "MAJOR_REVISION" ? (
        <Alert>
          <AlertTitle>Revision workflow</AlertTitle>
          <AlertDescription>
            The author will receive anonymized reviewer feedback and upload
            revised full and blinded manuscripts with a response to reviewers.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={makeDecision.isPending}>
          {makeDecision.isPending
            ? "Recording decision…"
            : "Record final decision"}
        </Button>
      </div>
    </form>
  );
}
