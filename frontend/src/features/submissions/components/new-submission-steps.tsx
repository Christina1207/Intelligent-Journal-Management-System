"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { CircleUserRound, FileCheck2, Info, ShieldCheck } from "lucide-react";

import {
  FormField,
  getFormFieldDescription,
} from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AuthUser } from "@/types/auth";
import type { PublicSection } from "@/features/journals/types";
import {
  CoauthorFields,
  type CoauthorFieldErrors,
} from "@/features/submissions/components/coauthor-fields";
import { KeywordInput } from "@/features/submissions/components/keyword-input";
import { ManuscriptFileField } from "@/features/submissions/components/manuscript-file-field";
import type { NewSubmissionFormValues } from "@/features/submissions/new-submission-schema";
import {
  formatFileSize,
  formatSubmissionLanguage,
} from "@/features/submissions/submission-formatters";

type SubmissionStepProps = {
  form: UseFormReturn<NewSubmissionFormValues>;
  disabled: boolean;
};

type DetailsStepProps = SubmissionStepProps & {
  sections: PublicSection[];
  sectionsLoading: boolean;
  sectionsError: boolean;
  onRetrySections: () => void;
};

export function ManuscriptDetailsStep({
  form,
  sections,
  sectionsLoading,
  sectionsError,
  disabled,
  onRetrySections,
}: DetailsStepProps) {
  const errors = form.formState.errors;

  return (
    <div className="grid gap-6">
      <StepIntroduction
        title="Manuscript details"
        description="Enter metadata exactly as it should appear in the journal record."
      />

      <FormField
        htmlFor="title"
        label="Manuscript title"
        description="Use the complete title as it appears in the manuscript."
        error={errors.title?.message}
        required
      >
        <Input
          id="title"
          maxLength={500}
          disabled={disabled}
          dir="auto"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={getFormFieldDescription({
            id: "title",
            hasDescription: true,
            hasError: Boolean(errors.title),
          })}
          {...form.register("title")}
        />
      </FormField>

      <FormField
        htmlFor="abstract"
        label="Abstract"
        description="The abstract supports editorial screening, topic analysis, and reviewer matching."
        error={errors.abstract?.message}
        required
      >
        <Textarea
          id="abstract"
          rows={9}
          disabled={disabled}
          dir="auto"
          aria-invalid={Boolean(errors.abstract)}
          aria-describedby={getFormFieldDescription({
            id: "abstract",
            hasDescription: true,
            hasError: Boolean(errors.abstract),
          })}
          {...form.register("abstract")}
        />
      </FormField>

      <Controller
        control={form.control}
        name="keywords"
        render={({ field, fieldState }) => (
          <KeywordInput
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            disabled={disabled}
          />
        )}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          htmlFor="section"
          label="Journal section"
          description="Only sections currently open for submissions are listed."
          error={errors.section?.message}
          required
        >
          <Select
            id="section"
            disabled={disabled || sectionsLoading || sectionsError}
            aria-invalid={Boolean(errors.section)}
            aria-describedby={getFormFieldDescription({
              id: "section",
              hasDescription: true,
              hasError: Boolean(errors.section),
            })}
            {...form.register("section")}
          >
            <option value="">
              {sectionsLoading ? "Loading sections…" : "Select a section"}
            </option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          htmlFor="language"
          label="Manuscript language"
          error={errors.language?.message}
          required
        >
          <Select
            id="language"
            disabled={disabled}
            aria-invalid={Boolean(errors.language)}
            aria-describedby={getFormFieldDescription({
              id: "language",
              hasError: Boolean(errors.language),
            })}
            {...form.register("language")}
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="fr">French</option>
          </Select>
        </FormField>
      </div>

      {sectionsError ? (
        <Notice
          tone="destructive"
          title="Journal sections are unavailable"
          description="The submission cannot continue until the active section list is loaded."
          action={
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={onRetrySections}
            >
              Try again
            </Button>
          }
        />
      ) : null}

      <FormField
        htmlFor="cover_letter"
        label="Cover letter"
        description="Optional message for the editorial team."
        error={errors.cover_letter?.message}
      >
        <Textarea
          id="cover_letter"
          rows={6}
          disabled={disabled}
          dir="auto"
          aria-invalid={Boolean(errors.cover_letter)}
          aria-describedby={getFormFieldDescription({
            id: "cover_letter",
            hasDescription: true,
            hasError: Boolean(errors.cover_letter),
          })}
          {...form.register("cover_letter")}
        />
      </FormField>
    </div>
  );
}

export function AuthorsStep({
  form,
  disabled,
  user,
}: SubmissionStepProps & { user: AuthUser | null }) {
  const coauthorError = form.formState.errors.coauthors;
  const coauthorFieldErrors = Array.isArray(coauthorError)
    ? coauthorError.map((item) => ({
        full_name: item?.full_name?.message,
        email: item?.email?.message,
        affiliation: item?.affiliation?.message,
        orcid: item?.orcid?.message,
        country: item?.country?.message,
      }))
    : [];
  const groupError = findFirstMessage(coauthorError);
  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.username
    : "Submitting author";

  return (
    <div className="grid gap-6">
      <StepIntroduction
        title="Authors"
        description="Confirm the submitting author and add co-authors in publication order."
      />

      <div className="rounded-lg border border-border bg-surface-muted/55 p-4">
        <div className="flex items-start gap-3">
          <CircleUserRound
            className="mt-0.5 size-5 shrink-0 text-accent"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Submitting and corresponding author
            </p>
            <p className="mt-1 font-medium text-foreground" dir="auto">
              {displayName}
            </p>
            {user ? (
              <p className="mt-0.5 break-all text-sm text-text-secondary">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Controller
        control={form.control}
        name="coauthors"
        render={({ field }) => (
          <CoauthorFields
            value={field.value}
            onChange={field.onChange}
            errors={coauthorFieldErrors as CoauthorFieldErrors}
            error={groupError}
            disabled={disabled}
          />
        )}
      />
    </div>
  );
}

export function FilesStep({ form, disabled }: SubmissionStepProps) {
  return (
    <div className="grid gap-6">
      <StepIntroduction
        title="Manuscript files"
        description="Upload the complete manuscript and a separate blinded copy. Each file must be a PDF no larger than 50 MB."
      />

      <Controller
        control={form.control}
        name="file"
        render={({ field, fieldState }) => (
          <ManuscriptFileField
            id="full-manuscript"
            label="Full manuscript PDF"
            description="May include author names, affiliations, acknowledgements, and other identifying details."
            value={field.value}
            error={fieldState.error?.message}
            disabled={disabled}
            onChange={field.onChange}
          />
        )}
      />

      <Notice
        tone="warning"
        icon={ShieldCheck}
        title="Prepare a genuinely anonymized copy"
        description="Remove author names, affiliations, acknowledgements, identifying self-references, and identifying document metadata."
      />

      <Controller
        control={form.control}
        name="blinded_file"
        render={({ field, fieldState }) => (
          <ManuscriptFileField
            id="blinded-manuscript"
            label="Blinded manuscript PDF"
            description="This is the copy intended for double-blind peer review."
            value={field.value}
            error={fieldState.error?.message}
            disabled={disabled}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  );
}

export function ReviewSubmissionStep({
  form,
  disabled,
  user,
  sections,
}: SubmissionStepProps & {
  user: AuthUser | null;
  sections: PublicSection[];
}) {
  const values = form.getValues();
  const section = sections.find((item) => item.id === values.section);
  const submittingAuthor = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.username
    : null;
  const confirmationError =
    findFirstMessage(form.formState.errors.confirm_original) ??
    findFirstMessage(form.formState.errors.confirm_authors) ??
    findFirstMessage(form.formState.errors.confirm_guidelines) ??
    findFirstMessage(form.formState.errors.confirm_files) ??
    findFirstMessage(form.formState.errors.confirm_workflow);

  return (
    <div className="grid gap-6">
      <StepIntroduction
        title="Review and submit"
        description="Check the metadata and files before sending this manuscript to the journal."
      />

      <Notice
        tone="info"
        icon={Info}
        title="This is not a saved server draft"
        description="Nothing is sent to the journal until you select Submit manuscript below."
      />

      <ReviewGroup title="Manuscript">
        <ReviewItem label="Title" value={values.title} autoDirection />
        <ReviewItem label="Section" value={section?.name} autoDirection />
        <ReviewItem
          label="Language"
          value={formatSubmissionLanguage(values.language)}
        />
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Keywords
          </dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {values.keywords.map((keyword) => (
              <Badge
                key={keyword}
                variant="secondary"
                className="rounded-md"
                dir="auto"
              >
                {keyword}
              </Badge>
            ))}
          </dd>
        </div>
        <ReviewItem label="Abstract" value={values.abstract} autoDirection />
        {values.cover_letter.trim() ? (
          <ReviewItem
            label="Cover letter"
            value={values.cover_letter}
            autoDirection
          />
        ) : null}
      </ReviewGroup>

      <ReviewGroup title="Authors">
        {submittingAuthor ? (
          <ReviewItem
            label="Submitting author"
            value={`${submittingAuthor}${user ? ` · ${user.email}` : ""}`}
            autoDirection
          />
        ) : null}
        {values.coauthors.length > 0 ? (
          <ol className="grid gap-2">
            {values.coauthors.map((coauthor, index) => (
              <li
                key={coauthor.clientId}
                className="rounded-md border border-border p-3 text-sm"
              >
                <span className="font-medium text-foreground" dir="auto">
                  {index + 2}. {coauthor.full_name}
                </span>
                <span className="mt-1 block text-text-secondary">
                  {coauthor.email}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-text-secondary">
            No additional authors were added.
          </p>
        )}
      </ReviewGroup>

      <ReviewGroup title="Files">
        <FileReview label="Full manuscript" file={values.file} />
        <FileReview label="Blinded manuscript" file={values.blinded_file} />
      </ReviewGroup>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-1 font-heading text-base font-medium text-foreground">
          Submission confirmation
        </legend>
        <div className="mt-2 grid gap-3">
          <Confirmation
            id="confirm-original"
            label="This manuscript has not been published and is not under review elsewhere."
            disabled={disabled}
            registration={form.register("confirm_original")}
          />
          <Confirmation
            id="confirm-authors"
            label="All authors have approved this submission."
            disabled={disabled}
            registration={form.register("confirm_authors")}
          />
          <Confirmation
            id="confirm-guidelines"
            label="The manuscript follows the journal author guidelines."
            disabled={disabled}
            registration={form.register("confirm_guidelines")}
          />
          <Confirmation
            id="confirm-files"
            label="Both PDFs are the correct manuscript versions."
            disabled={disabled}
            registration={form.register("confirm_files")}
          />
          <Confirmation
            id="confirm-workflow"
            label="I understand that submitting will send this manuscript into the editorial workflow."
            disabled={disabled}
            registration={form.register("confirm_workflow")}
          />
        </div>
        {confirmationError ? (
          <p className="mt-3 text-xs font-medium text-destructive" role="alert">
            {confirmationError}
          </p>
        ) : null}
      </fieldset>
    </div>
  );
}

function StepIntroduction({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-border pb-5">
      <h2 className="font-heading text-2xl font-medium text-foreground">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function ReviewGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border">
      <h3 className="border-b border-border bg-surface-muted px-4 py-3 font-heading font-medium text-foreground">
        {title}
      </h3>
      <dl className="grid gap-4 p-4">{children}</dl>
    </section>
  );
}

function ReviewItem({
  label,
  value,
  autoDirection,
}: {
  label: string;
  value?: string;
  autoDirection?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-foreground"
        dir={autoDirection ? "auto" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function FileReview({ label, file }: { label: string; file: File | null }) {
  if (!file) {
    return null;
  }

  return (
    <div className="flex items-start gap-2">
      <FileCheck2 className="mt-0.5 size-4 text-accent" aria-hidden="true" />
      <div>
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-1 text-sm font-medium text-foreground" dir="auto">
          {file.name}
        </dd>
        <dd className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </dd>
      </div>
    </div>
  );
}

function Confirmation({
  id,
  label,
  disabled,
  registration,
}: {
  id: string;
  label: string;
  disabled: boolean;
  registration: ReturnType<UseFormReturn<NewSubmissionFormValues>["register"]>;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 text-sm text-text-secondary hover:bg-surface-muted"
    >
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        className="mt-0.5 size-5 shrink-0 accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...registration}
      />
      <span>{label}</span>
    </label>
  );
}

function findFirstMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  ) {
    return (value as { message: string }).message;
  }

  for (const nestedValue of Object.values(value)) {
    const message = findFirstMessage(nestedValue);

    if (message) {
      return message;
    }
  }

  return undefined;
}
