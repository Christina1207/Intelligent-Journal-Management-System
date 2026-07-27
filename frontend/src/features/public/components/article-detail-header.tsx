import { CalendarDays } from "lucide-react"
import Link from "next/link"

import type { PublicArticle } from "../types"
import { formatArticleDate } from "../utils/article-details"
import { PublicBreadcrumbs } from "./public-breadcrumbs"

type ArticleDetailHeaderProps = {
  article: PublicArticle
}

function getOrcidHref(orcid: string) {
  return `https://orcid.org/${orcid.replace(/^https?:\/\/orcid\.org\//i, "")}`
}

export function ArticleDetailHeader({ article }: ArticleDetailHeaderProps) {
  const publishedDate = formatArticleDate(article.publishedAt)
  const authorDetails = [...(article.authorDetails ?? [])].sort(
    (first, second) => first.order - second.order
  )

  return (
    <header className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PublicBreadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Articles", href: "/articles" },
            { label: article.title },
          ]}
        />

        <div className="mt-7 max-w-4xl">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
            {article.sectionSlug ? (
              <Link
                href={`/sections/${article.sectionSlug}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {article.section}
              </Link>
            ) : (
              <span>{article.section}</span>
            )}
            {article.issueSlug && article.issue ? (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href={`/issues/${article.issueSlug}`}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  Issue {article.issue}
                </Link>
              </>
            ) : null}
            {publishedDate ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  <time dateTime={article.publishedAt}>{publishedDate}</time>
                </span>
              </>
            ) : null}
            {article.language ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{article.language}</span>
              </>
            ) : null}
          </div>

          <h1
            className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
            dir="auto"
          >
            {article.title}
          </h1>

          {authorDetails.length > 0 ? (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Authors">
              {authorDetails.map((author, index) => (
                <li key={`${author.fullName}-${index}`} className="text-sm">
                  <p className="font-semibold text-foreground" dir="auto">
                    {author.fullName}
                    {author.isCorresponding ? (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (corresponding)
                      </span>
                    ) : null}
                  </p>
                  {author.affiliation || author.country ? (
                    <p
                      className="mt-0.5 leading-5 text-text-secondary"
                      dir="auto"
                    >
                      {[author.affiliation, author.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                  {author.orcid ? (
                    <a
                      href={getOrcidHref(author.orcid)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex text-xs text-accent underline-offset-4 hover:underline"
                    >
                      ORCID {author.orcid}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : article.authors.length > 0 ? (
            <p className="mt-5 text-base leading-7 text-text-secondary" dir="auto">
              {article.authors.join(", ")}
            </p>
          ) : null}

          {authorDetails.length === 0 && article.affiliations?.length ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground" dir="auto">
              {article.affiliations.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  )
}
