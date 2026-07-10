import { ApiError } from "@/lib/api/errors";

type FieldErrors = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeFieldValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).join(" ");
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

export function getAuthFormError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function getAuthFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) {
    return {};
  }

  if (!isRecord(error.details)) {
    return {};
  }

  const errors: FieldErrors = {};

  for (const [field, value] of Object.entries(error.details)) {
    const normalizedValue = normalizeFieldValue(value);

    if (normalizedValue) {
      errors[field] = normalizedValue;
    }
  }

  return errors;
}
