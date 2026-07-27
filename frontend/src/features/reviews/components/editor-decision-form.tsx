"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gavel, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { useMakeEditorDecision } from "@/features/reviews/hooks";
import type { EditorDecision } from "@/features/reviews/types";
import { ApiError } from "@/lib/api/errors";

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
      "Accept the current version and permit publication-draft creation.",
  },
  {
    value: "MINOR_REVISION",
    label: "Minor revision",
    description:
      "Request limited corrections before another backend-controlled review round.",
  },
  {
    value: "MAJOR_REVISION",
    label: "Major revision",
    description:
      "Request substantial changes before another backend-controlled review round.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    description:
      "End this manuscript’s editorial workflow without a publishing handoff.",
  },
];

const decisionSchema = z
  .object({
    decision: z.union([
      z.enum(["ACCEPTED", "REJECTED", "MINOR_REVISION", "MAJOR_REVISION"]),
      z.literal(""),
    ]),
    decisionLetter: z.string().max(20_000, "Keep the decision letter concise."),
  })
  .superRefine((values, context) => {
    if (!values.decision) {
      context.addIssue({
        code: "custom",
        path: ["decision"],
        message: "Select an editorial decision.",
      });
      return;
    }

    if (
      values.decision !== "ACCEPTED" &&
      values.decisionLetter.trim().length < 10
    ) {
      context.addIssue({
        code: "custom",
        path: ["decisionLetter"],
        message:
          "Provide an author-facing explanation of at least 10 characters.",
      });
    }
  });

type DecisionFormValues = z.infer<typeof decisionSchema>;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The editorial decision could not be recorded.";
}

function apiFieldMessage(error: unknown, field: string) {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined;
  }

  const value = (error.details as Record<string, unknown>)[field];

  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }

  return typeof value === "string" ? value : undefined;
}

export function EditorDecisionForm({ submissionId }: EditorDecisionFormProps) {
  const makeDecision = useMakeEditorDecision();
  const router = useRouter();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<{
    decision: EditorDecision;
    decisionLetter: string;
  }>();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: {
      decision: "",
      decisionLetter: "",
    },
  });

  const decision = useWatch({ control, name: "decision" });
  const selectedOption = DECISION_OPTIONS.find(
    (option) => option.value === decision,
  );
  const decisionId = `editor-decision-${submissionId}`;
  const letterId = `decision-letter-${submissionId}`;

  const openConfirmation = handleSubmit((values) => {
    if (!values.decision) {
      return;
    }

    setPendingValues({
      decision: values.decision,
      decisionLetter: values.decisionLetter.trim(),
    });
    makeDecision.reset();
    setConfirmationOpen(true);
  });

  const confirmDecision = async () => {
    if (!pendingValues) {
      return;
    }

    try {
      const response = await makeDecision.mutateAsync({
        submissionId,
        payload: {
          decision: pendingValues.decision,
          decision_letter: pendingValues.decisionLetter,
        },
      });

      setConfirmationOpen(false);

      if (response.submission_status === "ACCEPTED") {
        router.replace(
          `/section-editor/submissions/${submissionId}/publishing`,
        );
      }
    } catch (error) {
      const decisionError = apiFieldMessage(error, "decision");
      const letterError = apiFieldMessage(error, "decision_letter");

      if (decisionError) {
        setError("decision", { type: "server", message: decisionError });
      }

      if (letterError) {
        setError("decisionLetter", { type: "server", message: letterError });
      }
    }
  };

  return (
    <>
      <form
        className="space-y-5 rounded-lg border border-primary/20 bg-primary/5 p-4"
        onSubmit={openConfirmation}
        noValidate
      >
        <div className="flex items-start gap-2">
          <Gavel className="mt-0.5 size-4 text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-medium">Record editorial decision</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Reviewer recommendations are advisory. Review every available
              report before selecting the author-facing outcome.
            </p>
          </div>
        </div>

        <FormField
          htmlFor={decisionId}
          label="Decision"
          description={selectedOption?.description}
          error={errors.decision?.message}
          required
        >
          <select
            id={decisionId}
            disabled={makeDecision.isPending}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={Boolean(errors.decision)}
            aria-describedby={getFormFieldDescription({
              id: decisionId,
              hasDescription: Boolean(selectedOption),
              hasError: Boolean(errors.decision),
            })}
            {...register("decision")}
          >
            <option value="">Select a decision</option>
            {DECISION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          htmlFor={letterId}
          label={
            <>
              Decision letter{" "}
              {decision === "ACCEPTED" ? (
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              ) : null}
            </>
          }
          description="This letter is visible to the author. Do not include reviewer identities or confidential editor-only comments."
          error={errors.decisionLetter?.message}
          required={decision !== "ACCEPTED"}
        >
          <Textarea
            id={letterId}
            dir="auto"
            rows={7}
            disabled={makeDecision.isPending}
            placeholder={
              decision === "ACCEPTED"
                ? "Optionally add final editorial comments for the author."
                : "Explain the decision and provide clear, actionable revision or rejection reasons."
            }
            aria-invalid={Boolean(errors.decisionLetter)}
            aria-describedby={getFormFieldDescription({
              id: letterId,
              hasDescription: true,
              hasError: Boolean(errors.decisionLetter),
            })}
            {...register("decisionLetter")}
          />
        </FormField>

        {decision === "ACCEPTED" ? (
          <Alert>
            <AlertTitle>Publishing handoff</AlertTitle>
            <AlertDescription>
              Acceptance enables publication-draft creation. Creating a draft
              remains a separate action and does not publish the article.
            </AlertDescription>
          </Alert>
        ) : null}

        {decision === "MINOR_REVISION" || decision === "MAJOR_REVISION" ? (
          <Alert>
            <AlertTitle>Revision workflow</AlertTitle>
            <AlertDescription>
              The author will receive anonymized reviewer feedback. On upload,
              the backend carries accepted reviewers into the next round
              without a new optional invitation.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={makeDecision.isPending}>
            Review decision
          </Button>
        </div>
      </form>

      <Dialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!makeDecision.isPending) {
            setConfirmationOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Confirm {selectedOption?.label.toLocaleLowerCase() ?? "decision"}?
            </DialogTitle>
            <DialogDescription>
              This records the decision for the current manuscript version and
              changes the author-visible workflow state.
            </DialogDescription>
          </DialogHeader>

          <Alert
            variant={
              pendingValues?.decision === "REJECTED"
                ? "destructive"
                : "warning"
            }
          >
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>This action cannot be submitted twice</AlertTitle>
            <AlertDescription>
              The backend rejects decisions that are premature or already
              recorded. Confirm only after checking the reports and letter.
            </AlertDescription>
          </Alert>

          {makeDecision.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Decision not recorded</AlertTitle>
              <AlertDescription>
                {getErrorMessage(makeDecision.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={makeDecision.isPending}
                />
              }
            >
              Return to review
            </DialogClose>
            <Button
              type="button"
              variant={
                pendingValues?.decision === "REJECTED"
                  ? "destructive"
                  : "default"
              }
              disabled={makeDecision.isPending}
              onClick={confirmDecision}
            >
              {makeDecision.isPending
                ? "Recording decision…"
                : `Confirm ${selectedOption?.label ?? "decision"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
