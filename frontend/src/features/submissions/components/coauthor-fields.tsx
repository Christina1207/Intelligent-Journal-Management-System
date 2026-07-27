"use client";

import { Plus, Trash2, UserRoundPlus } from "lucide-react";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SubmissionCoAuthorInput } from "@/features/submissions/types";

export type CoauthorDraft = SubmissionCoAuthorInput & {
  clientId: string;
};

export type CoauthorFieldErrors = Array<
  Partial<Record<keyof SubmissionCoAuthorInput, string>>
>;

type CoauthorFieldsProps = {
  value: CoauthorDraft[];
  onChange: (coauthors: CoauthorDraft[]) => void;
  errors?: CoauthorFieldErrors;
  error?: string;
  disabled?: boolean;
};

const emptyCoauthor = (): CoauthorDraft => ({
  clientId: crypto.randomUUID(),
  full_name: "",
  email: "",
  affiliation: "",
  orcid: "",
  country: "",
});

export function CoauthorFields({
  value,
  onChange,
  errors = [],
  error,
  disabled = false,
}: CoauthorFieldsProps) {
  function updateCoauthor(
    clientId: string,
    field: keyof SubmissionCoAuthorInput,
    fieldValue: string,
  ) {
    onChange(
      value.map((coauthor) =>
        coauthor.clientId === clientId
          ? { ...coauthor, [field]: fieldValue }
          : coauthor,
      ),
    );
  }

  function removeCoauthor(clientId: string) {
    onChange(value.filter((coauthor) => coauthor.clientId !== clientId));
  }

  return (
    <section aria-labelledby="additional-authors-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="additional-authors-heading"
            className="font-heading text-lg font-medium text-foreground"
          >
            Additional authors
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Add co-authors in publication order. The submitting author must not
            be added again.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="touch"
          disabled={disabled || value.length >= 20}
          onClick={() => onChange([...value, emptyCoauthor()])}
        >
          <Plus aria-hidden="true" />
          Add co-author
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface-muted/45 p-5 text-sm text-muted-foreground">
          <UserRoundPlus className="size-5 shrink-0" aria-hidden="true" />
          No additional authors have been added.
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {value.map((coauthor, index) => (
            <fieldset
              key={coauthor.clientId}
              disabled={disabled}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <legend className="font-heading text-sm font-medium text-foreground">
                  Co-author {index + 1}
                </legend>
                <Button
                  type="button"
                  variant="destructive"
                  size="touch"
                  onClick={() => removeCoauthor(coauthor.clientId)}
                  aria-label={`Remove co-author ${index + 1}`}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </div>

              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <CoauthorInput
                  id={`coauthor-name-${coauthor.clientId}`}
                  label="Full name"
                  value={coauthor.full_name}
                  error={errors[index]?.full_name}
                  required
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "full_name", nextValue)
                  }
                />
                <CoauthorInput
                  id={`coauthor-email-${coauthor.clientId}`}
                  label="Email"
                  type="email"
                  autoComplete="email"
                  value={coauthor.email}
                  error={errors[index]?.email}
                  required
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "email", nextValue)
                  }
                />
                <CoauthorInput
                  id={`coauthor-affiliation-${coauthor.clientId}`}
                  label="Affiliation"
                  value={coauthor.affiliation}
                  error={errors[index]?.affiliation}
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "affiliation", nextValue)
                  }
                />
                <CoauthorInput
                  id={`coauthor-orcid-${coauthor.clientId}`}
                  label="ORCID"
                  value={coauthor.orcid}
                  error={errors[index]?.orcid}
                  placeholder="0000-0000-0000-0000"
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "orcid", nextValue)
                  }
                />
                <CoauthorInput
                  id={`coauthor-country-${coauthor.clientId}`}
                  label="Country"
                  value={coauthor.country}
                  error={errors[index]?.country}
                  autoComplete="country-name"
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "country", nextValue)
                  }
                />
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-right text-xs text-muted-foreground">
        {value.length}/20 additional authors
      </p>
    </section>
  );
}

function CoauthorInput({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <FormField
      htmlFor={id}
      label={label}
      error={error}
      required={required}
    >
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={getFormFieldDescription({
          id,
          hasError: Boolean(error),
        })}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}
