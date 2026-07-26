"use client";

import type { SubmissionCoAuthorInput } from "@/features/submissions/types";

export type CoauthorDraft = SubmissionCoAuthorInput & {
  clientId: string;
};

type CoauthorFieldsProps = {
  value: CoauthorDraft[];
  onChange: (coauthors: CoauthorDraft[]) => void;
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
    <section className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Authors</h2>
          <p className="mt-1 text-sm text-slate-500">
            You are the corresponding and first author. Add any additional
            authors in publication order.
          </p>
        </div>

        <button
          type="button"
          disabled={disabled || value.length >= 20}
          onClick={() => onChange([...value, emptyCoauthor()])}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add coauthor
        </button>
      </div>

      {value.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed p-5 text-sm text-slate-500">
          No additional authors have been added.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {value.map((coauthor, index) => (
            <fieldset
              key={coauthor.clientId}
              disabled={disabled}
              className="rounded-lg border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <legend className="text-sm font-semibold text-slate-950">
                  Author {index + 2}
                </legend>

                <button
                  type="button"
                  onClick={() => removeCoauthor(coauthor.clientId)}
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <CoauthorInput
                  id={`coauthor-name-${coauthor.clientId}`}
                  label="Full name"
                  value={coauthor.full_name}
                  required
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "full_name", nextValue)
                  }
                />

                <CoauthorInput
                  id={`coauthor-email-${coauthor.clientId}`}
                  label="Email"
                  type="email"
                  value={coauthor.email}
                  required
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "email", nextValue)
                  }
                />

                <CoauthorInput
                  id={`coauthor-affiliation-${coauthor.clientId}`}
                  label="Affiliation"
                  value={coauthor.affiliation}
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "affiliation", nextValue)
                  }
                />

                <CoauthorInput
                  id={`coauthor-orcid-${coauthor.clientId}`}
                  label="ORCID"
                  value={coauthor.orcid}
                  placeholder="0000-0000-0000-0000"
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "orcid", nextValue)
                  }
                />

                <CoauthorInput
                  id={`coauthor-country-${coauthor.clientId}`}
                  label="Country"
                  value={coauthor.country}
                  onChange={(nextValue) =>
                    updateCoauthor(coauthor.clientId, "country", nextValue)
                  }
                />
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}

function CoauthorInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
        {required ? " *" : ""}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
      />
    </div>
  );
}
