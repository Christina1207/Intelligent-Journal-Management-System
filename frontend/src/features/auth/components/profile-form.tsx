"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, CircleUserRound, IdCard, Save, Undo2 } from "lucide-react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateCurrentUserProfile } from "@/features/auth/api/auth-api";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  profileSchema,
  type ProfileFormValues,
} from "@/features/auth/schemas";
import { ApiError } from "@/lib/api/errors";
import type { UpdateCurrentUserProfilePayload } from "@/types/auth";
import { ROLE_LABELS } from "@/types/roles";

type EditableProfileField = keyof ProfileFormValues;

function getApiFieldErrors(error: unknown) {
  if (
    !(error instanceof ApiError) ||
    typeof error.details !== "object" ||
    error.details === null ||
    Array.isArray(error.details)
  ) {
    return {};
  }

  const errors: Partial<Record<EditableProfileField, string>> = {};

  for (const [field, value] of Object.entries(error.details)) {
    if (
      field !== "first_name" &&
      field !== "last_name" &&
      field !== "orcid" &&
      field !== "affiliation" &&
      field !== "country"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      errors[field] = value.map(String).join(" ");
    } else if (typeof value === "string") {
      errors[field] = value;
    }
  }

  return errors;
}

function getGeneralErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
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
}): ProfileFormValues {
  return {
    first_name: user.first_name ?? "",
    last_name: user.last_name ?? "",
    orcid: user.orcid ?? "",
    affiliation: user.affiliation ?? "",
    country: user.country ?? "",
  };
}

function buildChangedPayload(
  initialValues: ProfileFormValues,
  currentValues: ProfileFormValues,
): UpdateCurrentUserProfilePayload {
  const payload: UpdateCurrentUserProfilePayload = {};

  for (const key of Object.keys(currentValues) as EditableProfileField[]) {
    const currentValue = currentValues[key].trim();
    const initialValue = initialValues[key].trim();

    if (currentValue !== initialValue) {
      payload[key] = key === "orcid" ? currentValue.toUpperCase() : currentValue;
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

type ProfileTextFieldProps = {
  form: UseFormReturn<ProfileFormValues>;
  name: EditableProfileField;
  label: string;
  description?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  onEdit: () => void;
};

function ProfileTextField({
  form,
  name,
  label,
  description,
  placeholder,
  autoComplete,
  required,
  onEdit,
}: ProfileTextFieldProps) {
  const error = form.formState.errors[name]?.message;
  const registration = form.register(name);

  return (
    <FormField
      htmlFor={name}
      label={label}
      description={description}
      error={error}
      required={required}
    >
      <Input
        id={name}
        type="text"
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={getFormFieldDescription({
          id: name,
          hasDescription: Boolean(description),
          hasError: Boolean(error),
        })}
        {...registration}
        onChange={(event) => {
          registration.onChange(event);
          onEdit();
        }}
      />
    </FormField>
  );
}

export function ProfileForm() {
  const { user, refreshCurrentUser } = useAuth();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: user
      ? getInitialValues(user)
      : {
          first_name: "",
          last_name: "",
          orcid: "",
          affiliation: "",
          country: "",
        },
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateCurrentUserProfile,
    onSuccess: async (updatedUser) => {
      const currentUser = await refreshCurrentUser();
      form.reset(getInitialValues(currentUser ?? updatedUser));
      form.clearErrors();
      setSuccessMessage("Your profile has been updated.");
    },
    onError: (error) => {
      setSuccessMessage(null);

      for (const [field, message] of Object.entries(getApiFieldErrors(error))) {
        form.setError(field as EditableProfileField, {
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
  const watchedValues = useWatch({ control: form.control });

  if (!user) {
    return null;
  }

  const initialValues = getInitialValues(user);
  const currentValues: ProfileFormValues = {
    first_name: watchedValues.first_name ?? "",
    last_name: watchedValues.last_name ?? "",
    orcid: watchedValues.orcid ?? "",
    affiliation: watchedValues.affiliation ?? "",
    country: watchedValues.country ?? "",
  };
  const changedPayload = buildChangedPayload(initialValues, currentValues);
  const hasChanges = Object.keys(changedPayload).length > 0;
  const isSubmitting = updateProfileMutation.isPending;
  const displayName = getDisplayName(user);
  const formError = form.formState.errors.root?.message;

  function handleEdit() {
    setSuccessMessage(null);
    form.clearErrors("root");
  }

  function handleSubmit(values: ProfileFormValues) {
    const payload = buildChangedPayload(initialValues, values);

    if (Object.keys(payload).length === 0) {
      setSuccessMessage("Your profile is already up to date.");
      return;
    }

    setSuccessMessage(null);
    updateProfileMutation.mutate(payload);
  }

  function handleReset() {
    form.reset(initialValues);
    form.clearErrors();
    setSuccessMessage(null);
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Author account"
        title="Profile"
        description="Maintain the researcher information associated with your submissions and published article metadata."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-xl">Researcher information</CardTitle>
            <CardDescription>
              Update only the fields supported by your journal account.
              Username, email, account status, and roles are read-only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="grid gap-6"
              noValidate
            >
              {formError ? (
                <Notice
                  tone="destructive"
                  title="Profile update failed"
                  description={formError}
                />
              ) : null}

              {successMessage ? (
                <Notice
                  tone="success"
                  icon={Check}
                  title={successMessage}
                />
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <ProfileTextField
                  form={form}
                  name="first_name"
                  label="First name"
                  autoComplete="given-name"
                  required
                  onEdit={handleEdit}
                />
                <ProfileTextField
                  form={form}
                  name="last_name"
                  label="Last name"
                  autoComplete="family-name"
                  required
                  onEdit={handleEdit}
                />
              </div>

              <ProfileTextField
                form={form}
                name="orcid"
                label="ORCID"
                placeholder="0000-0000-0000-0000"
                description="Optional researcher identifier. The final character may be X."
                onEdit={handleEdit}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <ProfileTextField
                  form={form}
                  name="affiliation"
                  label="Affiliation"
                  autoComplete="organization"
                  placeholder="University or research institution"
                  onEdit={handleEdit}
                />
                <ProfileTextField
                  form={form}
                  name="country"
                  label="Country"
                  autoComplete="country-name"
                  onEdit={handleEdit}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-6 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  onClick={handleReset}
                  disabled={isSubmitting || !hasChanges}
                >
                  <Undo2 data-icon="inline-start" aria-hidden="true" />
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  size="touch"
                  disabled={isSubmitting || !hasChanges}
                >
                  <Save data-icon="inline-start" aria-hidden="true" />
                  {isSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <aside className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Account summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 border-b border-border pb-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
                  {displayName
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground" dir="auto">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-4 text-sm">
                <ReadOnlyItem label="Username" value={user.username} />
                <ReadOnlyItem label="Email" value={user.email} />
                <ReadOnlyItem
                  label="Account status"
                  value={user.status.replaceAll("_", " ").toLowerCase()}
                  capitalize
                />
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">
                    Roles
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Notice
            tone="info"
            icon={IdCard}
            title="Metadata quality"
            description="Affiliation, country, and ORCID help the editorial office maintain accurate author and publication records."
          />

          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted p-4 text-sm text-text-secondary">
            <CircleUserRound
              className="mt-0.5 size-5 shrink-0 text-accent"
              aria-hidden="true"
            />
            <p className="leading-6">
              Changes apply to your account. Metadata already captured in a
              submitted manuscript may remain part of that submission record.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReadOnlyItem({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd
        className={capitalize ? "mt-1 font-medium capitalize" : "mt-1 font-medium"}
        dir="auto"
      >
        {value}
      </dd>
    </div>
  );
}
