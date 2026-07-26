import { ArrowRight, CalendarDays, LibraryBig } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/section-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

import type { PublicArticle, PublicIssue } from "../types"
import { formatArticleDate } from "../utils/article-details"
import { ArticleCard } from "./article-card"

type CurrentIssuePreviewSectionProps = {
  issue: PublicIssue | null
  articles: PublicArticle[]
}

export function CurrentIssuePreviewSection({
  issue,
  articles,
}: CurrentIssuePreviewSectionProps) {
  const publishedDate = issue ? formatArticleDate(issue.publishedAt) : null

  return (
    <section
      className="border-y border-border bg-surface-muted/55 py-12 sm:py-16"
      aria-labelledby="current-issue-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          titleId="current-issue-title"
          title="Current issue"
          description="The journal’s most recently published issue and its contents."
          action={
            <Link
              href="/archives"
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              Browse archives
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          }
        />
        {issue ? (
          <div className="mt-7 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <Badge variant="info">Current issue</Badge>
              <h3 className="mt-4 text-2xl leading-snug font-semibold text-foreground">
                <Link
                  href={`/issues/${issue.slug}`}
                  className="underline-offset-4 hover:text-accent hover:underline"
                >
                  {issue.title}
                </Link>
              </h3>
              {publishedDate ? (
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  <time dateTime={issue.publishedAt}>{publishedDate}</time>
                </p>
              ) : null}
              {issue.description ? (
                <p
                  className="mt-4 line-clamp-4 text-sm leading-6 text-text-secondary"
                  dir="auto"
                >
                  {issue.description}
                </p>
              ) : null}
              {issue.volume || issue.issue ? (
                <p className="mt-4 text-sm font-medium text-foreground">
                  {[
                    issue.volume ? `Volume ${issue.volume}` : null,
                    issue.issue ? `Issue ${issue.issue}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              <Link
                href={`/issues/${issue.slug}`}
                className={buttonVariants({
                  variant: "accent",
                  size: "touch",
                  className: "mt-5 w-full",
                })}
              >
                View issue
              </Link>
            </article>

            {articles.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {articles.slice(0, 4).map((article) => (
                  <ArticleCard key={article.id} article={article} compact />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<LibraryBig aria-hidden="true" />}
                title="No public articles in this issue"
                description="Issue contents will appear here when articles are published."
              />
            )}
          </div>
        ) : (
          <EmptyState
            className="mt-7"
            icon={<LibraryBig aria-hidden="true" />}
            title="No current issue available"
            description="Published issues will appear here when they are released."
          />
        )}
      </div>
    </section>
  )
}
