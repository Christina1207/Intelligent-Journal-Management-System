import type { ApiErrorResponse } from "@/types/api"

export class ApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly details?: unknown

  constructor({ message, status, code, details }: ApiErrorResponse) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof Error) {
    return new ApiError({ message: error.message })
  }

  return new ApiError({ message: "An unexpected API error occurred." })
}
