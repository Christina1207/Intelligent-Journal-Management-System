import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-muted/45 p-8 text-center",
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h2 className="font-sans text-base font-semibold text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
