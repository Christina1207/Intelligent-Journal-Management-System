import Link from "next/link"

import type { PublicArticle } from "../types"
import { formatArticleDate, getDoiHref } from "../utils/article-details"

type ArticleMetadataCardProps = {
  article: PublicArticle
}

export function ArticleMetadataCard({ article }: ArticleMetadataCardProps) {
  const publishedDate = formatArticleDate(article.publishedAt)
  const receivedDate = article.receivedAt
    ? formatArticleDate(article.receivedAt)
    : null
  const acceptedDate = article.acceptedAt
    ? formatArticleDate(article.acceptedAt)
    : null

  return (
    <aside className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="font-sans text-base font-semibold text-foreground">
        Article information
      </h2>

      <dl className="mt-4 divide-y divide-border/70 text-sm">
        <div className="grid gap-1 py-3 first:pt-0">
          <dt className="text-xs font-medium text-muted-foreground">Section</dt>
          <dd className="text-foreground">
            {article.sectionSlug ? (
              <Link
                href={`/sections/${article.sectionSlug}`}
                className="text-accent underline-offset-4 hover:underline"
              >
                {article.section}
              </Link>
            ) : (
              article.section
            )}
          </dd>
        </div>

        {article.issue ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Issue</dt>
            <dd className="text-foreground">
              {article.issueSlug ? (
                <Link
                  href={`/issues/${article.issueSlug}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {[
                    article.volume ? `Volume ${article.volume}` : null,
                    `Issue ${article.issue}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Link>
              ) : (
                [
                  article.volume ? `Volume ${article.volume}` : null,
                  `Issue ${article.issue}`,
                ]
                  .filter(Boolean)
                  .join(", ")
              )}
            </dd>
          </div>
        ) : article.volume ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Volume</dt>
            <dd className="text-foreground">{article.volume}</dd>
          </div>
        ) : null}

        {article.pages ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">Pages</dt>
            <dd className="text-foreground">{article.pages}</dd>
          </div>
        ) : null}

        {publishedDate ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Published
            </dt>
            <dd className="text-foreground">{publishedDate}</dd>
          </div>
        ) : null}

        {receivedDate ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Received
            </dt>
            <dd className="text-foreground">{receivedDate}</dd>
          </div>
        ) : null}

        {acceptedDate ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Accepted
            </dt>
            <dd className="text-foreground">{acceptedDate}</dd>
          </div>
        ) : null}

        {article.language ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">
              Language
            </dt>
            <dd className="text-foreground">{article.language}</dd>
          </div>
        ) : null}

        {article.doi ? (
          <div className="grid gap-1 py-3">
            <dt className="text-xs font-medium text-muted-foreground">DOI</dt>
            <dd className="break-words">
              <a
                href={getDoiHref(article.doi)}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline-offset-4 hover:underline"
              >
                {article.doi}
              </a>
            </dd>
          </div>
        ) : null}

        {article.license ? (
          <div className="grid gap-1 py-3 last:pb-0">
            <dt className="text-xs font-medium text-muted-foreground">License</dt>
            <dd className="text-foreground">
              {article.licenseUrl ? (
                <a
                  href={article.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {article.license}
                </a>
              ) : (
                article.license
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  )
}
