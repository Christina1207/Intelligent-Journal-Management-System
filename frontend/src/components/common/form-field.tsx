import type { ComponentProps, ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps extends ComponentProps<"div"> {
  htmlFor: string
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  required?: boolean
}

export function FormField({
  htmlFor,
  label,
  description,
  error,
  required,
  children,
  className,
  ...props
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined

  return (
    <div
      className={cn("grid gap-2", className)}
      data-invalid={error ? "true" : undefined}
      {...props}
    >
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <>
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
            <span className="sr-only">required</span>
          </>
        ) : null}
      </Label>
      {children}
      {description ? (
        <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="text-xs leading-5 font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function getFormFieldDescription({
  id,
  hasDescription,
  hasError,
}: {
  id: string
  hasDescription?: boolean
  hasError?: boolean
}) {
  return [
    hasDescription ? `${id}-description` : null,
    hasError ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined
}
