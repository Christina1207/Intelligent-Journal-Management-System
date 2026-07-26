"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDefaultRouteForRoles } from "@/types/roles";
import { getAuthFieldErrors, getAuthFormError } from "./auth-form-errors";
import { useAuth } from "@/features/auth/hooks/use-auth";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const user = await login({ username, password });

      const nextPath = getSafeNextPath(searchParams.get("next"));
      const destination = nextPath ?? getDefaultRouteForRoles(user.roles);

      router.replace(destination);
    } catch (error) {
      setFormError(getAuthFormError(error));
      setFieldErrors(getAuthFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div>
        <Link href="/" className="text-sm font-medium text-slate-600">
          ← Back to journal
        </Link>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">
          Login
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Access your author dashboard and manage your manuscript submissions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-slate-700"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          />
          {fieldErrors.username ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.username}</p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          />
          {fieldErrors.password ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New author?{" "}
        <Link
          href={
            getSafeNextPath(searchParams.get("next"))
              ? `/register?next=${encodeURIComponent(
                  getSafeNextPath(searchParams.get("next"))!,
                )}`
              : "/register"
          }
          className="font-medium text-slate-950 hover:underline"
        >
          Create an author account
        </Link>
      </p>
    </div>
  );
}
