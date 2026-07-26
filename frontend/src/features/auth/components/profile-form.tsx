"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";

import { updateCurrentUserProfile } from "@/features/auth/api/auth-api";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ApiError } from "@/lib/api/errors";
import type { UpdateCurrentUserProfilePayload } from "@/types/auth";

const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

type EditableProfileField =
  | "first_name"
  | "last_name"
  | "orcid"
  | "affiliation"
  | "country";

type FormValues = Record<EditableProfileField, string>;
type FormErrors = Partial<Record<EditableProfileField | "form", string>>;

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

function getInitialValues(user: {
  first_name?: string;
  last_name?: string;
  orcid?: string;
  affiliation?: string;
  country?: string;
}): FormValues {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    orcid: user.orcid ?? "",
    affiliation: user.affiliation ?? "",
    country: user.country ?? "",
  };
}

function buildChangedPayload(
  initialValues: FormValues,
  currentValues: FormValues,
): UpdateCurrentUserProfilePayload {
  const payload: UpdateCurrentUserProfilePayload = {};

  for (const key of Object.keys(currentValues) as EditableProfileField[]) {
    const currentValue = currentValues[key].trim();
    const initialValue = initialValues[key].trim();

    if (currentValue !== initialValue) {
      payload[key] = currentValue;
    }
  }

  return payload;
}

function getDisplayName(user: {
  first_name?: string;
  last_name?: string;
  username: string;
}) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || user.username;
}

export function ProfileForm() {
  const { user, refreshCurrentUser } = useAuth();

  const initialValues = React.useMemo(
    () => (user ? getInitialValues(user) : null),
    [user],
  );

  const [values, setValues] = React.useState<FormValues>(() =>
    user
      ? getInitialValues(user)
      : {
          first_name: "",
          last_name: "",
          orcid: "",
          affiliation: "",
          country: "",
        },
  );
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (!user) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setValues(getInitialValues(user));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: async () => {
      await refreshCurrentUser();
      setSuccessMessage("Profile updated successfully.");
      setErrors({});
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrors({
        ...getApiFieldErrors(error),
        form: getGeneralErrorMessage(error),
      });
    },
  });

  if (!user || !initialValues) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading profile...
      </div>
    );
  }
  const currentInitialValues = initialValues;

  const changedPayload = buildChangedPayload(currentInitialValues, values);
  const hasChanges = Object.keys(changedPayload).length > 0;
  const isSubmitting = updateProfileMutation.isPending;

  function updateField(field: EditableProfileField, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));

    setSuccessMessage(null);

    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      delete nextErrors.form;
      return nextErrors;
    });
  }

  function validate() {
    const nextErrors: FormErrors = {};

    if (!values.first_name.trim()) {
      nextErrors.first_name = "First name is required.";
    }

    if (!values.last_name.trim()) {
      nextErrors.last_name = "Last name is required.";
    }

    if (values.orcid.trim() && !orcidPattern.test(values.orcid.trim())) {
      nextErrors.orcid =
        "ORCID must use the format 0000-0000-0000-0000. The final character may be X.";
    }

    return nextErrors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSuccessMessage(null);
      return;
    }

    const payload = buildChangedPayload(currentInitialValues, values);

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("No profile changes to save.");
      setErrors({});
      return;
    }

    updateProfileMutation.mutate(payload);
  }

  function handleReset() {
    setValues(currentInitialValues);
    setErrors({});
    setSuccessMessage(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Author account</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Manage the author information associated with your manuscript
          submissions. Username and email are read-only for account integrity.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            Editable profile information
          </h2>

          {errors.form ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.form}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <TextField
              id="first_name"
              label="First name"
              value={values.first_name}
              error={errors.first_name}
              onChange={(value) => updateField("first_name", value)}
              autoComplete="given-name"
              required
            />

            <TextField
              id="last_name"
              label="Last name"
              value={values.last_name}
              error={errors.last_name}
              onChange={(value) => updateField("last_name", value)}
              autoComplete="family-name"
              required
            />
          </div>

          <div className="mt-5">
            <TextField
              id="orcid"
              label="ORCID"
              value={values.orcid}
              error={errors.orcid}
              onChange={(value) => updateField("orcid", value)}
              placeholder="0000-0000-0000-0000"
            />
            <p className="mt-1 text-xs text-slate-500">
              Optional researcher identifier. Example: 0000-0002-1825-0097.
            </p>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <TextField
              id="affiliation"
              label="Affiliation"
              value={values.affiliation}
              error={errors.affiliation}
              onChange={(value) => updateField("affiliation", value)}
              placeholder="University or research institution"
            />

            <TextField
              id="country"
              label="Country"
              value={values.country}
              error={errors.country}
              onChange={(value) => updateField("country", value)}
              autoComplete="country-name"
            />
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || !hasChanges}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="rounded-md bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Account summary
            </h2>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
                {getDisplayName(user)
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  {getDisplayName(user)}
                </p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-4 text-sm">
              <ReadOnlyItem label="Username" value={user.username} />
              <ReadOnlyItem label="Email" value={user.email} />
              <ReadOnlyItem label="Status" value={user.status} />
              <div>
                <dt className="text-slate-500">Roles</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {role.replaceAll("_", " ")}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-lg font-semibold">Profile quality</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Complete affiliation, country, and ORCID information help the
              editorial office identify authors and maintain cleaner publication
              records.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

type TextFieldProps = {
  id: EditableProfileField;
  label: string;
  value: string;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  onChange: (value: string) => void;
};

function TextField({
  id,
  label,
  value,
  error,
  placeholder,
  autoComplete,
  required,
  onChange,
}: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function ReadOnlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value || "Not set"}</dd>
    </div>
  );
}
