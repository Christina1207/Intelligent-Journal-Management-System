import { SectionHeader } from "@/components/common/section-header"

import type { PublicArticle } from "../types"
import { ArticleCard } from "./article-card"

type ArticleRelatedSectionProps = {
  articles: PublicArticle[]
}

export function ArticleRelatedSection({
  articles,
}: ArticleRelatedSectionProps) {
  if (articles.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="related-articles-title">
      <SectionHeader
        titleId="related-articles-title"
        title="Related articles"
        description="More published research from the same journal section."
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} compact />
        ))}
      </div>
    </section>
  )
}
