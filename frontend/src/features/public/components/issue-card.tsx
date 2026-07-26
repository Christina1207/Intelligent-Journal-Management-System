import { ArrowRight, CalendarDays } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"

import type { PublicIssue } from "../types"
import { formatArticleDate } from "../utils/article-details"

type IssueCardProps = {
  issue: PublicIssue
}

export function IssueCard({ issue }: IssueCardProps) {
  const publishedDate = formatArticleDate(issue.publishedAt)

  return (
    <article className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {issue.isCurrent ? <Badge variant="info">Current issue</Badge> : null}
          {issue.volume ? (
            <span className="text-xs font-medium text-muted-foreground">
              Volume {issue.volume}
            </span>
          ) : null}
          {issue.issue ? (
            <span className="text-xs font-medium text-muted-foreground">
              Issue {issue.issue}
            </span>
          ) : null}
        </div>

        <h3
          className="mt-3 break-words text-xl leading-snug font-semibold text-foreground"
          dir="auto"
        >
          <Link
            href={`/issues/${issue.slug}`}
            className="underline-offset-4 hover:text-accent hover:underline"
          >
            {issue.title}
          </Link>
        </h3>

        {publishedDate ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <time dateTime={issue.publishedAt}>{publishedDate}</time>
          </p>
        ) : null}

        {issue.description ? (
          <p
            className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary"
            dir="auto"
          >
            {issue.description}
          </p>
        ) : null}
      </div>

      <Link
        href={`/issues/${issue.slug}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md text-sm font-semibold text-accent underline-offset-4 hover:underline"
      >
        View issue
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  )
}
