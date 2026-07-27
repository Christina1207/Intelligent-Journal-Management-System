"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  FilePlus2,
  LoaderCircle,
  Send,
} from "lucide-react";
import {
  useForm,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";

import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getPublicSections } from "@/features/journals/api/journals-api";
import { createSubmission } from "@/features/submissions/api/submissions-api";
import {
  AuthorsStep,
  FilesStep,
  ManuscriptDetailsStep,
  ReviewSubmissionStep,
} from "@/features/submissions/components/new-submission-steps";
import {
  submissionSteps,
  SubmissionStepProgress,
} from "@/features/submissions/components/submission-step-progress";
import {
  createNewSubmissionSchema,
  type NewSubmissionFormValues,
} from "@/features/submissions/new-submission-schema";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import { ApiError } from "@/lib/api/errors";

const stepFields: Array<Array<FieldPath<NewSubmissionFormValues>>> = [
  ["title", "abstract", "keywords", "language", "section", "cover_letter"],
  ["coauthors"],
  ["file", "blinded_file"],
  [
    "confirm_original",
    "confirm_authors",
    "confirm_guidelines",
    "confirm_files",
    "confirm_workflow",
  ],
];

const fieldStep: Partial<Record<FieldPath<NewSubmissionFormValues>, number>> = {
  title: 0,
  abstract: 0,
  keywords: 0,
  language: 0,
  section: 0,
  cover_letter: 0,
  coauthors: 1,
  file: 2,
  blinded_file: 2,
  confirm_original: 3,
  confirm_authors: 3,
  confirm_guidelines: 3,
  confirm_files: 3,
  confirm_workflow: 3,
};

const apiFields = new Set<FieldPath<NewSubmissionFormValues>>([
  "title",
  "abstract",
  "keywords",
  "language",
  "section",
  "cover_letter",
  "coauthors",
  "file",
  "blinded_file",
]);

export function NewSubmissionForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [submissionError, setSubmissionError] = React.useState<string | null>(
    null,
  );
  const stepHeadingRef = React.useRef<HTMLDivElement>(null);
  const schema = React.useMemo(
    () => createNewSubmissionSchema(user?.email),
    [user?.email],
  );
  const form = useForm<NewSubmissionFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      abstract: "",
      keywords: [],
      language: "en",
      section: "",
      cover_letter: "",
      coauthors: [],
      file: null,
      blinded_file: null,
      confirm_original: false,
      confirm_authors: false,
      confirm_guidelines: false,
      confirm_files: false,
      confirm_workflow: false,
    },
  });
  const sectionsQuery = useQuery({
    queryKey: ["public-sections"],
    queryFn: getPublicSections,
    staleTime: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  const createSubmissionMutation = useMutation({
    mutationFn: createSubmission,
    onSuccess: async (submission) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.dashboard(),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.lists(),
        }),
      ]);
      router.replace(`/author/submissions/${submission.id}`);
    },
    onError: (error) => {
      const apiFieldErrors = getApiFieldErrors(error);
      let earliestStep = 3;

      Object.entries(apiFieldErrors).forEach(([fieldName, message]) => {
        if (!apiFields.has(fieldName as FieldPath<NewSubmissionFormValues>)) {
          return;
        }

        const field = fieldName as FieldPath<NewSubmissionFormValues>;
        form.setError(field, { type: "server", message });
        earliestStep = Math.min(earliestStep, fieldStep[field] ?? 3);
      });

      setSubmissionError(getGeneralErrorMessage(error));
      setCurrentStep(earliestStep);
    },
  });

  const sections = sectionsQuery.data ?? [];
  const isSubmitting = createSubmissionMutation.isPending;

  async function goToNextStep() {
    setSubmissionError(null);
    const isValid = await form.trigger(stepFields[currentStep], {
      shouldFocus: true,
    });

    if (isValid) {
      setCurrentStep((step) => Math.min(step + 1, submissionSteps.length - 1));
    }
  }

  function goToPreviousStep() {
    setSubmissionError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function handleInvalid(errors: FieldErrors<NewSubmissionFormValues>) {
    const earliestStep = getEarliestErrorStep(errors);
    setSubmissionError(
      "Review the highlighted fields before submitting the manuscript.",
    );
    setCurrentStep(earliestStep);
  }

  function handleValidSubmit(values: NewSubmissionFormValues) {
    if (!values.file || !values.blinded_file || isSubmitting) {
      return;
    }

    setSubmissionError(null);
    createSubmissionMutation.mutate({
      title: values.title.trim(),
      abstract: values.abstract.trim(),
      language: values.language,
      section: values.section,
      cover_letter: values.cover_letter.trim(),
      keywords: values.keywords.map((keyword) => keyword.trim()),
      coauthors: values.coauthors.map((coauthor) => ({
        full_name: coauthor.full_name.trim(),
        email: coauthor.email.trim(),
        affiliation: coauthor.affiliation.trim(),
        orcid: coauthor.orcid.trim().toUpperCase(),
        country: coauthor.country.trim(),
      })),
      file: values.file,
      blinded_file: values.blinded_file,
    });
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="New manuscript"
        title="Submit a manuscript"
        description="Complete four local steps, then send one final submission to the journal. This form does not create a server-side draft."
        actions={
          <Link
            href="/author/submissions"
            className={buttonVariants({ variant: "outline", size: "touch" })}
          >
            Cancel
          </Link>
        }
      />

      <Card>
        <CardContent>
          <SubmissionStepProgress currentStep={currentStep} />
        </CardContent>
      </Card>

      {submissionError ? (
        <Notice
          tone="destructive"
          title="Submission could not continue"
          description={submissionError}
        />
      ) : null}

      {isSubmitting ? (
        <Notice
          tone="info"
          icon={LoaderCircle}
          title="Uploading your manuscript"
          description="Keep this page open while both PDFs and the manuscript metadata are sent. A percentage is not available from the current request layer."
          className="[&_svg]:animate-spin motion-reduce:[&_svg]:animate-none"
        />
      ) : null}

      <form
        onSubmit={form.handleSubmit(handleValidSubmit, handleInvalid)}
        aria-busy={isSubmitting}
        noValidate
      >
        <Card>
          <CardContent>
            <div
              ref={stepHeadingRef}
              tabIndex={-1}
              className="outline-none"
              aria-label={`Step ${currentStep + 1}: ${submissionSteps[currentStep]}`}
            >
              <div hidden={currentStep !== 0}>
                <ManuscriptDetailsStep
                  form={form}
                  sections={sections}
                  sectionsLoading={sectionsQuery.isLoading}
                  sectionsError={sectionsQuery.isError}
                  disabled={isSubmitting}
                  onRetrySections={() => sectionsQuery.refetch()}
                />
              </div>
              <div hidden={currentStep !== 1}>
                <AuthorsStep form={form} user={user} disabled={isSubmitting} />
              </div>
              <div hidden={currentStep !== 2}>
                <FilesStep form={form} disabled={isSubmitting} />
              </div>
              <div hidden={currentStep !== 3}>
                <ReviewSubmissionStep
                  form={form}
                  user={user}
                  sections={sections}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              {currentStep === 0 ? (
                <Link
                  href="/author/submissions"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "touch",
                  })}
                >
                  Cancel
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  onClick={goToPreviousStep}
                  disabled={isSubmitting}
                >
                  <ArrowLeft aria-hidden="true" />
                  Back
                </Button>
              )}

              {currentStep < submissionSteps.length - 1 ? (
                <Button
                  type="button"
                  variant="default"
                  size="touch"
                  onClick={goToNextStep}
                  disabled={
                    isSubmitting ||
                    sectionsQuery.isLoading ||
                    sectionsQuery.isError
                  }
                >
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="accent"
                  size="touch"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <LoaderCircle
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {isSubmitting ? "Submitting…" : "Submit manuscript"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <FilePlus2 className="size-4" aria-hidden="true" />
        One multipart request is sent only after final confirmation.
      </p>
    </div>
  );
}

function getApiFieldErrors(error: unknown) {
  const errors: Record<string, string> = {};

  if (
    !(error instanceof ApiError) ||
    !error.details ||
    typeof error.details !== "object" ||
    Array.isArray(error.details)
  ) {
    return errors;
  }

  Object.entries(error.details).forEach(([field, value]) => {
    const message = extractErrorMessage(value);

    if (message) {
      errors[field] = message;
    }
  });

  return errors;
}

function extractErrorMessage(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractErrorMessage(item);

      if (message) {
        return message;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      const message = extractErrorMessage(nestedValue);

      if (message) {
        return message;
      }
    }
  }

  return null;
}

function getGeneralErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "The journal could not receive this submission. Please try again.";
}

function getEarliestErrorStep(errors: FieldErrors<NewSubmissionFormValues>) {
  for (let step = 0; step < stepFields.length; step += 1) {
    if (stepFields[step].some((field) => hasFieldError(errors, field))) {
      return step;
    }
  }

  return 3;
}

function hasFieldError(
  errors: FieldErrors<NewSubmissionFormValues>,
  field: FieldPath<NewSubmissionFormValues>,
) {
  const [rootField] = field.split(".");
  return Boolean(errors[rootField as keyof FieldErrors<NewSubmissionFormValues>]);
}
