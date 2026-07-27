import { ArrowUpRight, FileText } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

import type { PublicArticle } from "../types"
import { formatArticleDate, getDoiHref } from "../utils/article-details"
import { ArticleCardDownloadButton } from "./article-card-download-button"

type ArticleCardProps = {
  article: PublicArticle
  compact?: boolean
}

export function ArticleCard({
  article,
  compact = false,
}: ArticleCardProps) {
  const publishedDate = formatArticleDate(article.publishedAt)

  return (
    <article className="group rounded-xl border border-border/85 bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
        {article.sectionSlug ? (
          <Link
            href={`/sections/${article.sectionSlug}`}
            className="rounded-sm text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {article.section}
          </Link>
        ) : (
          <span>{article.section}</span>
        )}
        {publishedDate ? (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt}>{publishedDate}</time>
          </>
        ) : null}
        {article.language ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{article.language}</span>
          </>
        ) : null}
      </div>

      <h3
        className="mt-3 text-xl leading-snug font-semibold tracking-tight text-foreground"
        dir="auto"
      >
        <Link
          href={`/articles/${article.slug}`}
          className="rounded-sm decoration-accent underline-offset-4 group-hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {article.title}
        </Link>
      </h3>

      {article.authors.length > 0 ? (
        <p className="mt-2 text-sm leading-6 text-text-secondary" dir="auto">
          {article.authors.join(", ")}
        </p>
      ) : null}

      {article.abstract ? (
        <p
          className={
            compact
              ? "mt-3 line-clamp-2 text-sm leading-6 text-text-secondary"
              : "mt-4 line-clamp-3 text-sm leading-6 text-text-secondary"
          }
          dir="auto"
        >
          {article.abstract}
        </p>
      ) : null}

      {article.keywords.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Keywords">
          {article.keywords.slice(0, compact ? 3 : 5).map((keyword) => (
            <Badge key={keyword} variant="secondary" dir="auto">
              {keyword}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 border-t border-border/75 pt-4 sm:flex-row sm:items-center sm:justify-between">
        {article.doi ? (
          <a
            href={getDoiHref(article.doi)}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            DOI: {article.doi}
          </a>
        ) : (
          <span />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/articles/${article.slug}`}
            className={buttonVariants({ variant: "outline", size: "touch" })}
          >
            <FileText data-icon="inline-start" aria-hidden="true" />
            View
            <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
          </Link>
          <ArticleCardDownloadButton slug={article.slug} />
        </div>
      </div>
    </article>
  )
}
