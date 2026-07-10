"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getAuthFieldErrors, getAuthFormError } from "./auth-form-errors";
import { useAuth } from "@/features/auth/hooks/use-auth";

const orcidPattern = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/author";
  }

  return value;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const payload = {
      username: String(formData.get("username") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
      password_confirm: String(formData.get("password_confirm") ?? ""),
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      orcid: String(formData.get("orcid") ?? "").trim(),
      affiliation: String(formData.get("affiliation") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
    };

    const nextFieldErrors: Record<string, string> = {};

    if (payload.password !== payload.password_confirm) {
      nextFieldErrors.password_confirm = "Passwords do not match.";
    }

    if (payload.orcid && !orcidPattern.test(payload.orcid)) {
      nextFieldErrors.orcid =
        "ORCID must use the format 0000-0000-0000-0000. The final character may be X.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError("Please fix the highlighted fields.");
      return;
    }

    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await register(payload);
      router.replace(getSafeNextPath(searchParams.get("next")));
    } catch (error) {
      setFormError(getAuthFormError(error));
      setFieldErrors(getAuthFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div>
        <Link href="/" className="text-sm font-medium text-slate-600">
          ← Back to journal
        </Link>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">
          Create an author account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Register to submit manuscripts and track your editorial progress.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="first_name"
            label="First name"
            autoComplete="given-name"
            error={fieldErrors.first_name}
            required
          />
          <TextField
            name="last_name"
            label="Last name"
            autoComplete="family-name"
            error={fieldErrors.last_name}
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="username"
            label="Username"
            autoComplete="username"
            error={fieldErrors.username}
            required
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={fieldErrors.email}
            required
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.password}
            required
          />
          <TextField
            name="password_confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={fieldErrors.password_confirm}
            required
          />
        </div>

        <TextField
          name="orcid"
          label="ORCID"
          placeholder="0000-0000-0000-0000"
          error={fieldErrors.orcid}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="affiliation"
            label="Affiliation"
            placeholder="University or research institution"
            error={fieldErrors.affiliation}
          />
          <TextField
            name="country"
            label="Country"
            autoComplete="country-name"
            error={fieldErrors.country}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link
          href={`/login${
            searchParams.get("next")
              ? `?next=${encodeURIComponent(getSafeNextPath(searchParams.get("next")))}`
              : ""
          }`}
          className="font-medium text-slate-950 hover:underline"
        >
          Login
        </Link>
      </p>
    </div>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
};

function TextField({
  name,
  label,
  type = "text",
  placeholder,
  autoComplete,
  error,
  required,
}: TextFieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
