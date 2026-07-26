"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadRevisedManuscript } from "@/features/submissions/api/submissions-api";
import { ApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type RevisionUploadFormProps = {
  submissionId: string;
};

type FormErrors = Partial<
  Record<"file" | "blinded_file" | "response_to_reviewers", string>
>;

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
  const [blindedFile, setBlindedFile] = React.useState<File | null>(null);
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

      if (!blindedFile) {
        throw new Error("Please upload the blinded manuscript PDF.");
      }

      return uploadRevisedManuscript(submissionId, {
        file,
        blinded_file: blindedFile,
        response_to_reviewers: responseToReviewers.trim(),
      });
    },
    onSuccess: async () => {
      setFile(null);
      setBlindedFile(null);
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

  function handleBlindedFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setBlindedFile(selectedFile);

    setSuccessMessage(null);

    if (!selectedFile) {
      return;
    }

    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors.blinded_file;
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

    if (!blindedFile) {
      errors.blinded_file = "Please upload the blinded manuscript PDF.";
    } else if (!isPdfFile(blindedFile)) {
      errors.blinded_file = "Only PDF files are accepted.";
    } else if (blindedFile.size > MAX_FILE_SIZE_BYTES) {
      errors.blinded_file = "The blinded manuscript must be 50MB or smaller.";
    }

    if (!responseToReviewers.trim()) {
      errors.response_to_reviewers =
        "Provide a point-by-point response to the reviewer comments.";
    } else if (responseToReviewers.trim().length < 20) {
      errors.response_to_reviewers =
        "The response must contain at least 20 characters.";
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
        The editor has requested a revised manuscript. Upload updated full and
        blinded PDFs and explain how you addressed the reviewer comments.
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
            Full manuscript PDF - may contain author names, affiliations and
            acknowledgements.
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

        <div>
          <label
            htmlFor="revision-blinded-file"
            className="block text-sm font-medium text-slate-700"
          >
            Blinded manuscript PDF - must remove author names, affiliations,
            acknowledgements and identifying metadata.
          </label>
          <input
            id="revision-blinded-file"
            name="blinded_file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleBlindedFileChange}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
          {fieldErrors.blinded_file ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.blinded_file}
            </p>
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

        {blindedFile ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">{blindedFile.name}</p>
            <p className="mt-1 text-slate-500">
              {(blindedFile.size / 1024 / 1024).toFixed(2)} MB
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
            rows={8}
            required
            value={responseToReviewers}
            disabled={isSubmitting}
            onChange={(event) => {
              setResponseToReviewers(event.target.value);
              setSuccessMessage(null);

              setFieldErrors((currentErrors) => {
                const nextErrors = { ...currentErrors };
                delete nextErrors.response_to_reviewers;
                return nextErrors;
              });
            }}
            placeholder={`Provide a point-by-point response, for example:

          Reviewer 1, Comment 1:
          Response:
          Change made in manuscript:

          Reviewer 2, Comment 1:
          Response:
          Change made in manuscript:`}
            className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {fieldErrors.response_to_reviewers ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.response_to_reviewers}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-600">
              Required. Respond to each reviewer separately without including
              confidential or identifying information.
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
