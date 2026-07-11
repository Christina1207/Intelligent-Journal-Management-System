"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadRevisedManuscript } from "@/features/submissions/api/submissions-api";
import { ApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type RevisionUploadFormProps = {
  submissionId: string;
};

type FormErrors = Partial<Record<"file" | "response_to_reviewers", string>>;

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

function getApiFieldErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) {
    return {};
  }

  if (
    typeof error.details !== "object" ||
    error.details === null ||
    Array.isArray(error.details)
  ) {
    return {};
  }

  const errors: FormErrors = {};

  for (const [field, value] of Object.entries(error.details)) {
    if (Array.isArray(value)) {
      errors[field as keyof FormErrors] = value.map(String).join(" ");
    } else if (typeof value === "string") {
      errors[field as keyof FormErrors] = value;
    }
  }

  return errors;
}

function getGeneralErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function RevisionUploadForm({ submissionId }: RevisionUploadFormProps) {
  const queryClient = useQueryClient();

  const [file, setFile] = React.useState<File | null>(null);
  const [responseToReviewers, setResponseToReviewers] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) {
        throw new Error("Please upload the revised manuscript PDF.");
      }

      return uploadRevisedManuscript(submissionId, {
        file,
        response_to_reviewers: responseToReviewers,
      });
    },
    onSuccess: async () => {
      setFile(null);
      setResponseToReviewers("");
      setFormError(null);
      setFieldErrors({});
      setSuccessMessage("Revised manuscript uploaded successfully.");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["submission-detail", submissionId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["submission-versions", submissionId],
        }),
        queryClient.invalidateQueries({ queryKey: ["author-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["author-submissions"] }),
      ]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setFormError(getGeneralErrorMessage(error));
      setFieldErrors(getApiFieldErrors(error));
    },
  });

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);

    setSuccessMessage(null);

    if (!selectedFile) {
      return;
    }

    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.file;
      return nextErrors;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errors: FormErrors = {};

    if (!file) {
      errors.file = "Please upload the revised manuscript PDF.";
    } else if (!isPdfFile(file)) {
      errors.file = "Only PDF files are accepted.";
    } else if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.file = "The revised manuscript must be 50MB or smaller.";
    }

    setFormError(null);
    setSuccessMessage(null);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError("Please fix the highlighted fields before uploading.");
      return;
    }

    uploadMutation.mutate();
  }

  const isSubmitting = uploadMutation.isPending;

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">
        Revision required
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-700">
        The editor has requested a revised manuscript. Upload a new PDF and
        optionally explain how you addressed the reviewer comments.
      </p>

      {formError ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="revision-file"
            className="block text-sm font-medium text-slate-700"
          >
            Revised manuscript PDF
          </label>
          <input
            id="revision-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
          {fieldErrors.file ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.file}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-600">
              PDF only. Maximum file size: 50MB.
            </p>
          )}
        </div>

        {file ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">{file.name}</p>
            <p className="mt-1 text-slate-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="response-to-reviewers"
            className="block text-sm font-medium text-slate-700"
          >
            Response to reviewers
          </label>
          <textarea
            id="response-to-reviewers"
            name="response_to_reviewers"
            rows={6}
            value={responseToReviewers}
            onChange={(event) => setResponseToReviewers(event.target.value)}
            placeholder="Briefly explain what changed in the revised manuscript."
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          />
          {fieldErrors.response_to_reviewers ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.response_to_reviewers}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-600">
              Optional, but recommended for a clear revision trail.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex rounded-md bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Uploading revision..." : "Upload revised manuscript"}
        </button>
      </form>
    </section>
  );
}
