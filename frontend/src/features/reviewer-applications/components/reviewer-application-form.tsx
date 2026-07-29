"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Save, Send } from "lucide-react";
import { useForm } from "react-hook-form";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  submitReviewerApplication,
  updateReviewerApplication,
} from "@/features/reviewer-applications/api/reviewer-applications-api";
import { reviewerApplicationQueryKeys } from "@/features/reviewer-applications/query-keys";
import {
  parseExpertiseKeywords,
  reviewerApplicationSchema,
  type ReviewerApplicationFormValues,
} from "@/features/reviewer-applications/schemas";
import type {
  ReviewerApplication,
  ReviewerApplicationPayload,
  ReviewerApplicationSection,
} from "@/features/reviewer-applications/types";
import { ApiError } from "@/lib/api/errors";

type ReviewerApplicationFormProps = {
  application: ReviewerApplication | null;
  sections: ReviewerApplicationSection[];
};

type ApplicationFormField = keyof ReviewerApplicationFormValues;

function getInitialValues(
  application: ReviewerApplication | null,
): ReviewerApplicationFormValues {
  return {
    sectionId: application?.section.id ?? "",
    keywordsText: application?.keywords.join(", ") ?? "",
    biography: application?.biography ?? "",
  };
}

function buildPayload(
  values: ReviewerApplicationFormValues,
): ReviewerApplicationPayload {
  return {
    section_id: values.sectionId,
    keywords: parseExpertiseKeywords(values.keywordsText),
    biography: values.biography.trim(),
  };
}

function getGeneralErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "The reviewer application could not be saved.";
}

function getApiFieldErrors(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    typeof error.details !== "object" ||
    error.details === null ||
    Array.isArray(error.details)
  ) {
    return {};
  }

  const fieldMap: Record<string, ApplicationFormField> = {
    section_id: "sectionId",
    keywords: "keywordsText",
    biography: "biography",
  };

  const fieldErrors: Partial<Record<ApplicationFormField, string>> = {};

  for (const [backendField, value] of Object.entries(error.details)) {
    const frontendField = fieldMap[backendField];

    if (!frontendField) {
      continue;
    }

    if (Array.isArray(value)) {
      fieldErrors[frontendField] = value.map(String).join(" ");
    } else if (typeof value === "string") {
      fieldErrors[frontendField] = value;
    }
  }

  return fieldErrors;
}

export function ReviewerApplicationForm({
  application,
  sections,
}: ReviewerApplicationFormProps) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const form = useForm<ReviewerApplicationFormValues>({
    resolver: zodResolver(reviewerApplicationSchema),
    defaultValues: getInitialValues(application),
  });

  React.useEffect(() => {
    form.reset(getInitialValues(application));
  }, [application, form]);

  const saveMutation = useMutation({
    mutationFn: (payload: ReviewerApplicationPayload) => {
      if (application) {
        return updateReviewerApplication(payload);
      }

      return submitReviewerApplication(payload);
    },

    onSuccess: (savedApplication) => {
      queryClient.setQueryData(
        reviewerApplicationQueryKeys.own(),
        savedApplication,
      );

      form.reset(getInitialValues(savedApplication));
      form.clearErrors();

      if (!application) {
        setSuccessMessage("Your reviewer application has been submitted.");
      } else if (application.status === "REJECTED") {
        setSuccessMessage("Your application has been updated and resubmitted.");
      } else {
        setSuccessMessage("Your application changes have been saved.");
      }
    },

    onError: (error) => {
      setSuccessMessage(null);

      const fieldErrors = getApiFieldErrors(error);

      for (const [field, message] of Object.entries(fieldErrors)) {
        form.setError(field as ApplicationFormField, {
          type: "server",
          message,
        });
      }

      form.setError("root", {
        type: "server",
        message: getGeneralErrorMessage(error),
      });
    },
  });

  const sectionError = form.formState.errors.sectionId?.message;
  const keywordsError = form.formState.errors.keywordsText?.message;
  const biographyError = form.formState.errors.biography?.message;
  const formError = form.formState.errors.root?.message;

  const isSubmitting = saveMutation.isPending;

  let submitLabel = "Submit application";

  if (application?.status === "PENDING") {
    submitLabel = "Save changes";
  }

  if (application?.status === "REJECTED") {
    submitLabel = "Update and resubmit";
  }

  function handleSubmit(values: ReviewerApplicationFormValues) {
    setSuccessMessage(null);
    form.clearErrors("root");
    saveMutation.mutate(buildPayload(values));
  }

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>
          {application ? "Reviewer application" : "Apply to become a reviewer"}
        </CardTitle>

        <CardDescription>
          Select one journal section and describe the expertise you can
          contribute to its peer-review process.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          className="grid gap-6"
          onSubmit={form.handleSubmit(handleSubmit)}
          aria-busy={isSubmitting}
          noValidate
        >
          {formError ? (
            <Notice
              tone="destructive"
              title="Application could not be saved"
              description={formError}
            />
          ) : null}

          {successMessage ? (
            <Notice tone="success" icon={Check} title={successMessage} />
          ) : null}

          <FormField
            htmlFor="reviewer-application-section"
            label="Journal section"
            description="You can apply to review for one section only."
            error={sectionError}
            required
          >
            <Select
              id="reviewer-application-section"
              aria-invalid={Boolean(sectionError)}
              aria-describedby={getFormFieldDescription({
                id: "reviewer-application-section",
                hasDescription: true,
                hasError: Boolean(sectionError),
              })}
              disabled={isSubmitting}
              {...form.register("sectionId")}
            >
              <option value="">Select a section</option>

              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            htmlFor="reviewer-application-keywords"
            label="Expertise keywords"
            description={
              "Provide 3–20 distinct keywords separated by commas or new lines."
            }
            error={keywordsError}
            required
          >
            <Textarea
              id="reviewer-application-keywords"
              rows={5}
              placeholder={
                "machine learning, natural language processing, information retrieval"
              }
              aria-invalid={Boolean(keywordsError)}
              aria-describedby={getFormFieldDescription({
                id: "reviewer-application-keywords",
                hasDescription: true,
                hasError: Boolean(keywordsError),
              })}
              disabled={isSubmitting}
              {...form.register("keywordsText")}
            />
          </FormField>

          <FormField
            htmlFor="reviewer-application-biography"
            label="Academic biography"
            description={
              "Describe your research background, subject expertise, and relevant peer-review experience."
            }
            error={biographyError}
            required
          >
            <Textarea
              id="reviewer-application-biography"
              rows={10}
              placeholder={
                "Describe your academic background and reviewing expertise..."
              }
              aria-invalid={Boolean(biographyError)}
              aria-describedby={getFormFieldDescription({
                id: "reviewer-application-biography",
                hasDescription: true,
                hasError: Boolean(biographyError),
              })}
              disabled={isSubmitting}
              {...form.register("biography")}
            />
          </FormField>

          <div className="flex justify-end border-t border-border pt-6">
            <Button
              type="submit"
              variant="accent"
              size="touch"
              disabled={isSubmitting || sections.length === 0}
            >
              {application ? (
                <Save data-icon="inline-start" aria-hidden="true" />
              ) : (
                <Send data-icon="inline-start" aria-hidden="true" />
              )}

              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
