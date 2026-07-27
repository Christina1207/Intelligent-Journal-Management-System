import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"

import type { PublicSection } from "../types"

type PublicSectionCardProps = {
  section: PublicSection
  compact?: boolean
}

export function PublicSectionCard({
  section,
  compact = false,
}: PublicSectionCardProps) {
  return (
    <article className="group rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <h2
          className={
            compact
              ? "text-xl leading-snug font-semibold text-foreground"
              : "text-2xl leading-snug font-semibold text-foreground"
          }
          dir="auto"
        >
          <Link
            href={`/sections/${section.slug}`}
            className="rounded-sm underline-offset-4 group-hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {section.name}
          </Link>
        </h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {section.articleCount} article
          {section.articleCount === 1 ? "" : "s"}
        </span>
      </div>

      {section.description ? (
        <p
          className="mt-3 line-clamp-3 text-sm leading-6 text-text-secondary"
          dir="auto"
        >
          {section.description}
        </p>
      ) : null}

      {section.topics.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Section topics">
          {section.topics.slice(0, 5).map((topic) => (
            <Badge key={topic} variant="secondary" dir="auto">
              {topic}
            </Badge>
          ))}
        </div>
      ) : null}

      <Link
        href={`/sections/${section.slug}`}
        className="mt-5 inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Browse section
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  )
}
