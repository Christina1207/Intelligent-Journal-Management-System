"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  loginSchema,
  type LoginFormValues,
} from "@/features/auth/schemas";
import { withNextPath } from "@/features/auth/utils/safe-next-path";
import { getDefaultRouteForRoles } from "@/types/roles";

import { getAuthFieldErrors, getAuthFormError } from "./auth-form-errors";
import { PasswordInput } from "./password-input";

const loginFieldNames = new Set<keyof LoginFormValues>([
  "username",
  "password",
]);

export function LoginForm({ nextPath }: { nextPath: string | null }) {
  const router = useRouter();
  const { login } = useAuth();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const formError = form.formState.errors.root?.message;

  async function handleSubmit(values: LoginFormValues) {
    form.clearErrors();

    try {
      const user = await login(values);
      router.replace(nextPath ?? getDefaultRouteForRoles(user.roles));
    } catch (error) {
      const backendErrors = getAuthFieldErrors(error);

      for (const [field, message] of Object.entries(backendErrors)) {
        if (loginFieldNames.has(field as keyof LoginFormValues)) {
          form.setError(field as keyof LoginFormValues, {
            type: "server",
            message,
          });
        }
      }

      form.setError("root", {
        type: "server",
        message: getAuthFormError(error),
      });
    }
  }

  const usernameError = form.formState.errors.username?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <div className="mx-auto w-full max-w-md">
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Author account
        </p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Sign in to manage submissions, respond to revision requests, and
          follow editorial decisions.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="mt-8 grid gap-5"
        aria-busy={form.formState.isSubmitting}
        noValidate
      >
        {formError ? (
          <Notice
            tone="destructive"
            title="We could not sign you in"
            description={formError}
          />
        ) : null}

        <FormField
          htmlFor="username"
          label="Username"
          required
          error={usernameError}
        >
          <Input
            id="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(usernameError)}
            aria-describedby={getFormFieldDescription({
              id: "username",
              hasError: Boolean(usernameError),
            })}
            {...form.register("username")}
          />
        </FormField>

        <FormField
          htmlFor="password"
          label="Password"
          required
          error={passwordError}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(passwordError)}
            aria-describedby={getFormFieldDescription({
              id: "password",
              hasError: Boolean(passwordError),
            })}
            {...form.register("password")}
          />
        </FormField>

        <Button
          type="submit"
          variant="accent"
          size="touch"
          className="mt-1 w-full"
          disabled={form.formState.isSubmitting}
        >
          <LogIn data-icon="inline-start" aria-hidden="true" />
          {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="mt-7 border-t border-border pt-6">
        <p className="text-sm text-text-secondary">
          New to the journal?{" "}
          <Link
            href={withNextPath("/register", nextPath)}
            className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline"
          >
            Create an author account
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </div>
  );
}
