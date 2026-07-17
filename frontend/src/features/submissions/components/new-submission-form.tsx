"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPublicSections } from "@/features/journals/api/journals-api";
import { createSubmission } from "@/features/submissions/api/submissions-api";
import { ApiError } from "@/lib/api/errors";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const languageOptions = [
  { label: "English", value: "en" },
  { label: "Arabic", value: "ar" },
  { label: "French", value: "fr" },
];

type FormErrors = Partial<Record<string, string>>;

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
      errors[field] = value.map(String).join(" ");
    } else if (typeof value === "string") {
      errors[field] = value;
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

export function NewSubmissionForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [file, setFile] = React.useState<File | null>(null);
  const [blindedFile, setBlindedFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>({});

  const sectionsQuery = useQuery({
    queryKey: ["public-sections"],
    queryFn: getPublicSections,
  });

  const createSubmissionMutation = useMutation({
    mutationFn: createSubmission,
    onSuccess: async (submission) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["author-dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["author-submissions"] }),
      ]);

      router.replace(`/author/submissions/${submission.id}`);
    },
    onError: (error) => {
      setFormError(getGeneralErrorMessage(error));
      setFieldErrors(getApiFieldErrors(error));
    },
  });

  function validateForm(formData: FormData) {
    const errors: FormErrors = {};

    const title = String(formData.get("title") ?? "").trim();
    const abstract = String(formData.get("abstract") ?? "").trim();
    const language = String(formData.get("language") ?? "").trim();
    const section = String(formData.get("section") ?? "").trim();

    if (!title) {
      errors.title = "Title is required.";
    }

    if (!abstract) {
      errors.abstract = "Abstract is required.";
    }

    if (!language) {
      errors.language = "Language is required.";
    }

    if (!section) {
      errors.section = "Section is required.";
    }

    if (!file) {
      errors.file = "Please upload the manuscript PDF.";
    } else if (!isPdfFile(file)) {
      errors.file = "Only PDF files are accepted.";
    } else if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.file = "The manuscript file must be 50MB or smaller.";
    }

    if (!blindedFile) {
      errors.blinded_file = "Please upload the blinded manuscript PDF.";
    } else if (!isPdfFile(blindedFile)) {
      errors.blinded_file = "Only PDF files are accepted.";
    } else if (blindedFile.size > MAX_FILE_SIZE_BYTES) {
      errors.blinded_file =
        "The blinded manuscript file must be 50MB or smaller.";
    }

    const confirmations = [
      "confirm_original",
      "confirm_authors",
      "confirm_guidelines",
      "confirm_pdf",
    ];

    const missingConfirmation = confirmations.some(
      (confirmation) => formData.get(confirmation) !== "on",
    );

    if (missingConfirmation) {
      errors.confirmations =
        "Please confirm all manuscript submission requirements.";
    }

    return errors;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);

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

    const formData = new FormData(event.currentTarget);
    const errors = validateForm(formData);

    setFormError(null);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormError("Please fix the highlighted fields before submitting.");
      return;
    }

    createSubmissionMutation.mutate({
      title: String(formData.get("title") ?? "").trim(),
      abstract: String(formData.get("abstract") ?? "").trim(),
      language: String(formData.get("language") ?? "").trim(),
      section: String(formData.get("section") ?? "").trim(),
      cover_letter: String(formData.get("cover_letter") ?? "").trim(),
      file: file as File,
      blinded_file: blindedFile as File,
    });
  }

  const sections = sectionsQuery.data ?? [];
  const isSubmitting = createSubmissionMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-500">New manuscript</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Submit Manuscript
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Provide the manuscript metadata, choose the appropriate journal
            section, and upload the final PDF for editorial screening.
          </p>
        </div>

        {formError ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Manuscript information
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-700"
            >
              Manuscript title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              maxLength={500}
              required
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
            {fieldErrors.title ? (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.title}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                Use the complete title exactly as it appears in the manuscript.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="abstract"
              className="block text-sm font-medium text-slate-700"
            >
              Abstract
            </label>
            <textarea
              id="abstract"
              name="abstract"
              rows={8}
              required
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
            />
            {fieldErrors.abstract ? (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.abstract}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                The abstract is used for editorial screening, topic analysis,
                and reviewer recommendation.
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="section"
                className="block text-sm font-medium text-slate-700"
              >
                Journal section
              </label>
              <select
                id="section"
                name="section"
                required
                disabled={sectionsQuery.isLoading}
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">
                  {sectionsQuery.isLoading
                    ? "Loading sections..."
                    : "Select a section"}
                </option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
              {fieldErrors.section ? (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.section}
                </p>
              ) : null}
              {sectionsQuery.isError ? (
                <p className="mt-1 text-sm text-red-600">
                  Could not load journal sections. Please refresh the page.
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-slate-700"
              >
                Manuscript language
              </label>
              <select
                id="language"
                name="language"
                defaultValue="en"
                required
                className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
              >
                {languageOptions.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label}
                  </option>
                ))}
              </select>
              {fieldErrors.language ? (
                <p className="mt-1 text-sm text-red-600">
                  {fieldErrors.language}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Manuscript file
        </h2>

        <div className="mt-5 space-y-5">
          <label
            htmlFor="file"
            className="block text-sm font-medium text-slate-700"
          >
            Full manuscript PDF - may contain author names, affiliations and acknowledgements.
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={handleFileChange}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
          {fieldErrors.file ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.file}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              PDF only. Maximum file size: 50MB.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="blinded_file"
            className="block text-sm font-medium text-slate-700"
          >
            Blinded manuscript PDF - must remove author names, affiliations, acknowledgements and identifying metadata.
          </label>
          <input
            id="blinded_file"
            name="blinded_file"
            type="file"
            accept="application/pdf,.pdf"
            required
            onChange={(event) => {
              const selectedFile = event.target.files?.[0] ?? null;
              setBlindedFile(selectedFile);

              if (!selectedFile) {
                return;
              }

              setFieldErrors((currentErrors) => {
                const nextErrors = { ...currentErrors };
                delete nextErrors.blinded_file;
                return nextErrors;
              });
            }}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
          {fieldErrors.blinded_file ? (
            <p className="mt-1 text-sm text-red-600">
              {fieldErrors.blinded_file}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              PDF only. Maximum file size: 50MB.
            </p>
          )}
        </div>

        {file ? (
          <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">{file.name}</p>
            <p className="mt-1 text-slate-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : null}

        {blindedFile ? (
          <div className="mt-4 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-950">{blindedFile.name}</p>
            <p className="mt-1 text-slate-500">
              {(blindedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Cover letter</h2>
        <p className="mt-1 text-sm text-slate-500">
          Optional message to the editorial team.
        </p>

        <textarea
          id="cover_letter"
          name="cover_letter"
          rows={6}
          className="mt-5 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
        />
      </section>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Author confirmation
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Confirm the manuscript is ready for editorial screening.
        </p>

        <div className="mt-5 space-y-3">
          <ConfirmationCheckbox
            name="confirm_original"
            label="I confirm this manuscript has not been published elsewhere and is not under review by another journal."
          />
          <ConfirmationCheckbox
            name="confirm_authors"
            label="I confirm all authors have approved this submission."
          />
          <ConfirmationCheckbox
            name="confirm_guidelines"
            label="I confirm the manuscript follows the journal author guidelines."
          />
          <ConfirmationCheckbox
            name="confirm_pdf"
            label="I confirm the uploaded PDF is the correct manuscript file for review."
          />
        </div>

        {fieldErrors.confirmations ? (
          <p className="mt-3 text-sm text-red-600">
            {fieldErrors.confirmations}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-3 rounded-xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/author/submissions"
          className="inline-flex justify-center rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={isSubmitting || sectionsQuery.isLoading}
          className="inline-flex justify-center rounded-md bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Submitting manuscript..." : "Submit manuscript"}
        </button>
      </div>
    </form>
  );
}

function ConfirmationCheckbox({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  return (
    <label className="flex gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-950"
      />
      <span>{label}</span>
    </label>
  );
}
