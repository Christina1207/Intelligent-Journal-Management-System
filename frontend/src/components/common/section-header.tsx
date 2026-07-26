import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  titleId?: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({
  title,
  titleId,
  description,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0">
        <h2
          id={titleId}
          className="break-words text-2xl leading-tight font-semibold tracking-tight text-foreground"
          dir="auto"
        >
          {title}
        </h2>
        {description ? (
          <div className="mt-1.5 max-w-2xl text-sm leading-6 text-text-secondary">
            {description}
          </div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
