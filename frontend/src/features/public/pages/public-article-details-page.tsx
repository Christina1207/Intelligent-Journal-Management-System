import Link from "next/link"

import { Badge } from "@/components/ui/badge"

import { ArticleAbstractSection } from "../components/article-abstract-section"
import { ArticleActionPanel } from "../components/article-action-panel"
import { ArticleDetailHeader } from "../components/article-detail-header"
import { ArticleMetadataCard } from "../components/article-metadata-card"
import { ArticleRelatedSection } from "../components/article-related-section"
import type { PublicArticle } from "../types"

type PublicArticleDetailsPageProps = {
  article: PublicArticle
  relatedArticles: PublicArticle[]
}

export function PublicArticleDetailsPage({
  article,
  relatedArticles,
}: PublicArticleDetailsPageProps) {
  return (
    <>
      <ArticleDetailHeader article={article} />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-8">
        <article className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-8">
          <ArticleAbstractSection article={article} />

          {article.keywords.length > 0 ? (
            <section
              className="mt-8 border-t border-border pt-7"
              aria-labelledby="keywords-title"
            >
              <h2
                id="keywords-title"
                className="text-2xl font-semibold tracking-tight text-foreground"
              >
                Keywords
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {article.keywords.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="secondary"
                    render={
                      <Link
                        href={`/articles?search=${encodeURIComponent(keyword)}`}
                        dir="auto"
                      />
                    }
                  >
                    {keyword}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}
        </article>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ArticleActionPanel article={article} />
          <ArticleMetadataCard article={article} />
        </div>
      </div>

      {relatedArticles.length > 0 ? (
        <div className="border-t border-border bg-surface-muted/45 py-10 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ArticleRelatedSection articles={relatedArticles} />
          </div>
        </div>
      ) : null}
    </>
  )
}
