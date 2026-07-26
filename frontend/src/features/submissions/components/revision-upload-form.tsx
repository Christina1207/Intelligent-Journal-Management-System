"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { FilePenLine, LoaderCircle, Send } from "lucide-react";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { uploadRevisedManuscript } from "@/features/submissions/api/submissions-api";
import { ManuscriptFileField } from "@/features/submissions/components/manuscript-file-field";
import { submissionQueryKeys } from "@/features/submissions/query-keys";
import {
  revisionUploadSchema,
  type RevisionUploadFormValues,
} from "@/features/submissions/revision-upload-schema";
import { ApiError } from "@/lib/api/errors";

type RevisionUploadFormProps = {
  submissionId: string;
};

const revisionFields = new Set<keyof RevisionUploadFormValues>([
  "file",
  "blinded_file",
  "response_to_reviewers",
]);

export function RevisionUploadForm({ submissionId }: RevisionUploadFormProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RevisionUploadFormValues>({
    resolver: zodResolver(revisionUploadSchema),
    mode: "onTouched",
    defaultValues: {
      file: null,
      blinded_file: null,
      response_to_reviewers: "",
    },
  });
  const uploadMutation = useMutation({
    mutationFn: uploadRevision,
    onMutate: () => {
      setServerError(null);
    },
    onSuccess: async () => {
      form.reset();
      setServerError(null);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.detail(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.versions(submissionId),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.dashboard(),
        }),
        queryClient.invalidateQueries({
          queryKey: submissionQueryKeys.lists(),
        }),
      ]);
    },
    onError: (error) => {
      const apiErrors = getApiFieldErrors(error);

      Object.entries(apiErrors).forEach(([field, message]) => {
        if (revisionFields.has(field as keyof RevisionUploadFormValues)) {
          form.setError(field as keyof RevisionUploadFormValues, {
            type: "server",
            message,
          });
        }
      });

      setServerError(getGeneralErrorMessage(error));
    },
  });

  function uploadRevision(values: RevisionUploadFormValues) {
    if (!values.file || !values.blinded_file) {
      throw new Error("Choose both revised manuscript PDFs.");
    }

    return uploadRevisedManuscript(submissionId, {
      file: values.file,
      blinded_file: values.blinded_file,
      response_to_reviewers: values.response_to_reviewers.trim(),
    });
  }

  const isSubmitting = uploadMutation.isPending;
  return (
    <Card className="border-status-action-border">
      <CardHeader className="border-b border-status-action-border bg-status-action-subtle">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FilePenLine
            className="size-5 text-status-action-foreground"
            aria-hidden="true"
          />
          Upload revised manuscript
        </CardTitle>
        <p className="text-sm leading-6 text-text-secondary">
          Replace both PDFs and include a detailed response. The revision
          remains part of this submission&apos;s version history.
        </p>
      </CardHeader>
      <CardContent>
        {serverError ? (
          <Notice
            className="mb-5"
            tone="destructive"
            title="Revision upload failed"
            description={serverError}
          />
        ) : null}

        {isSubmitting ? (
          <Notice
            className="mb-5 [&_svg]:animate-spin"
            tone="info"
            icon={LoaderCircle}
            title="Uploading revised files"
            description="Keep this page open until the journal confirms the new version."
          />
        ) : null}

        <form
          onSubmit={form.handleSubmit((values) =>
            uploadMutation.mutate(values),
          )}
          className="grid gap-6"
          aria-busy={isSubmitting}
          noValidate
        >
          <Controller
            control={form.control}
            name="file"
            render={({ field, fieldState }) => (
              <ManuscriptFileField
                id="revision-full-manuscript"
                label="Full revised manuscript PDF"
                description="May include author names, affiliations, acknowledgements, and identifying details. PDF only, maximum 50 MB."
                value={field.value}
                error={fieldState.error?.message}
                disabled={isSubmitting}
                onChange={(file) => {
                  form.clearErrors("file");
                  setServerError(null);
                  field.onChange(file);
                }}
              />
            )}
          />

          <ManuscriptFileFieldController
            form={form}
            disabled={isSubmitting}
          />

          <FormField
            htmlFor="response-to-reviewers"
            label="Point-by-point response to reviewers"
            description="Required, 20–20,000 characters. Address each released comment and identify the corresponding manuscript change."
            error={form.formState.errors.response_to_reviewers?.message}
            required
          >
            <Textarea
              id="response-to-reviewers"
              rows={10}
              disabled={isSubmitting}
              dir="auto"
              placeholder={"Reviewer 1, comment 1:\nResponse:\nChange made:"}
              aria-invalid={Boolean(
                form.formState.errors.response_to_reviewers,
              )}
              aria-describedby={getFormFieldDescription({
                id: "response-to-reviewers",
                hasDescription: true,
                hasError: Boolean(
                  form.formState.errors.response_to_reviewers,
                ),
              })}
              {...form.register("response_to_reviewers", {
                onChange: () => {
                  form.clearErrors("response_to_reviewers");
                  setServerError(null);
                },
              })}
            />
          </FormField>

          <div className="flex justify-end border-t border-border pt-5">
            <Button
              type="submit"
              variant="default"
              size="touch"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {isSubmitting ? "Uploading revision…" : "Submit revision"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ManuscriptFileFieldController({
  form,
  disabled,
}: {
  form: ReturnType<typeof useForm<RevisionUploadFormValues>>;
  disabled: boolean;
}) {
  return (
    <Controller
      control={form.control}
      name="blinded_file"
      render={({ field, fieldState }) => (
        <ManuscriptFileField
          id="revision-blinded-manuscript"
          label="Blinded revised manuscript PDF"
          description="Remove author names, affiliations, acknowledgements, identifying self-references, and document metadata. The frontend cannot verify anonymity. PDF only, maximum 50 MB."
          value={field.value}
          error={fieldState.error?.message}
          disabled={disabled}
          onChange={(file) => {
            form.clearErrors("blinded_file");
            field.onChange(file);
          }}
        />
      )}
    />
  );
}

function getApiFieldErrors(error: unknown) {
  const errors: Partial<Record<keyof RevisionUploadFormValues, string>> = {};

  if (
    !(error instanceof ApiError) ||
    !error.details ||
    typeof error.details !== "object" ||
    Array.isArray(error.details)
  ) {
    return errors;
  }

  Object.entries(error.details).forEach(([field, value]) => {
    if (!revisionFields.has(field as keyof RevisionUploadFormValues)) {
      return;
    }

    const message = Array.isArray(value)
      ? value.map(String).join(" ")
      : typeof value === "string"
        ? value
        : null;

    if (message) {
      errors[field as keyof RevisionUploadFormValues] = message;
    }
  });

  return errors;
}

function getGeneralErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "The journal could not receive this revision. Please try again.";
}
