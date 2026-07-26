"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";

import { FormField, getFormFieldDescription } from "@/components/common/form-field";
import { Notice } from "@/components/common/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas";
import { withNextPath } from "@/features/auth/utils/safe-next-path";

import { getAuthFieldErrors, getAuthFormError } from "./auth-form-errors";
import { PasswordInput } from "./password-input";

const registerFieldNames = new Set<keyof RegisterFormValues>([
  "first_name",
  "last_name",
  "username",
  "email",
  "password",
  "password_confirm",
  "orcid",
  "affiliation",
  "country",
]);

type RegistrationFieldProps = {
  form: UseFormReturn<RegisterFormValues>;
  name: keyof RegisterFormValues;
  label: string;
  type?: "text" | "email";
  autoComplete?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
};

function RegistrationField({
  form,
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  description,
  required,
}: RegistrationFieldProps) {
  const error = form.formState.errors[name]?.message;

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
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={getFormFieldDescription({
          id: name,
          hasDescription: Boolean(description),
          hasError: Boolean(error),
        })}
        {...form.register(name)}
      />
    </FormField>
  );
}

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { register } = useAuth();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      email: "",
      password: "",
      password_confirm: "",
      orcid: "",
      affiliation: "",
      country: "",
    },
  });

  const formError = form.formState.errors.root?.message;
  const passwordError = form.formState.errors.password?.message;
  const passwordConfirmationError =
    form.formState.errors.password_confirm?.message;

  async function handleSubmit(values: RegisterFormValues) {
    form.clearErrors();

    try {
      await register({
        ...values,
        orcid: values.orcid.toUpperCase(),
      });
      router.replace(nextPath);
    } catch (error) {
      const backendErrors = getAuthFieldErrors(error);

      for (const [field, message] of Object.entries(backendErrors)) {
        if (registerFieldNames.has(field as keyof RegisterFormValues)) {
          form.setError(field as keyof RegisterFormValues, {
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

  return (
    <div className="w-full">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Author registration
        </p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Register once to submit manuscripts and track their progress through
          the journal workflow.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="mt-8 grid gap-7"
        noValidate
      >
        {formError ? (
          <Notice
            tone="destructive"
            title="We could not create your account"
            description={formError}
          />
        ) : null}

        <fieldset className="grid gap-5">
          <legend className="font-heading text-xl font-semibold text-foreground">
            Account details
          </legend>
          <p className="-mt-3 text-sm leading-6 text-muted-foreground">
            These details identify you when signing in and receiving journal
            correspondence.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <RegistrationField
              form={form}
              name="first_name"
              label="First name"
              autoComplete="given-name"
              required
            />
            <RegistrationField
              form={form}
              name="last_name"
              label="Last name"
              autoComplete="family-name"
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <RegistrationField
              form={form}
              name="username"
              label="Username"
              autoComplete="username"
              description="Used to sign in to your author account."
              required
            />
            <RegistrationField
              form={form}
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              description="Used for submission and decision notifications."
              required
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              htmlFor="password"
              label="Password"
              description="Use at least 8 characters. Avoid common, entirely numeric, or personally similar passwords."
              error={passwordError}
              required
            >
              <PasswordInput
                id="password"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={getFormFieldDescription({
                  id: "password",
                  hasDescription: true,
                  hasError: Boolean(passwordError),
                })}
                {...form.register("password")}
              />
            </FormField>
            <FormField
              htmlFor="password_confirm"
              label="Confirm password"
              error={passwordConfirmationError}
              required
            >
              <PasswordInput
                id="password_confirm"
                autoComplete="new-password"
                aria-invalid={Boolean(passwordConfirmationError)}
                aria-describedby={getFormFieldDescription({
                  id: "password_confirm",
                  hasError: Boolean(passwordConfirmationError),
                })}
                {...form.register("password_confirm")}
              />
            </FormField>
          </div>
        </fieldset>

        <fieldset className="grid gap-5 border-t border-border pt-7">
          <legend className="font-heading text-xl font-semibold text-foreground">
            Researcher details
          </legend>
          <p className="-mt-3 text-sm leading-6 text-muted-foreground">
            Optional details improve manuscript metadata and can be completed
            later from your profile.
          </p>

          <RegistrationField
            form={form}
            name="orcid"
            label="ORCID"
            placeholder="0000-0000-0000-0000"
            description="Your 16-digit researcher identifier, when available."
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <RegistrationField
              form={form}
              name="affiliation"
              label="Affiliation"
              autoComplete="organization"
              placeholder="University or research institution"
            />
            <RegistrationField
              form={form}
              name="country"
              label="Country"
              autoComplete="country-name"
            />
          </div>
        </fieldset>

        <Notice
          tone="info"
          title="What happens after registration?"
          description="Your author workspace opens immediately. If you arrived from “Submit Manuscript,” you will return directly to the submission form."
        />

        <Button
          type="submit"
          variant="accent"
          size="touch"
          className="w-full sm:w-fit sm:min-w-48"
          disabled={form.formState.isSubmitting}
        >
          <UserPlus data-icon="inline-start" aria-hidden="true" />
          {form.formState.isSubmitting
            ? "Creating account..."
            : "Create author account"}
        </Button>
      </form>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm text-text-secondary">
          Already registered?{" "}
          <Link
            href={withNextPath("/login", nextPath)}
            className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline"
          >
            Sign in
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </p>
      </div>
    </div>
  );
}
