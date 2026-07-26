import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: ReactNode
  eyebrow?: ReactNode
  breadcrumbs?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-border/80 pb-6 sm:flex sm:items-end sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0">
        {breadcrumbs ? <div className="mb-4">{breadcrumbs}</div> : null}
        {eyebrow ? (
          <div className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1
          className="text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl"
          dir="auto"
        >
          {title}
        </h1>
        {description ? (
          <div className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="mt-5 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
          {actions}
        </div>
      ) : null}
    </header>
  )
}
