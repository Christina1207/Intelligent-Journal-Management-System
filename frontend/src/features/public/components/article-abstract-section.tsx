import type { PublicArticle } from "../types"

type ArticleAbstractSectionProps = {
  article: PublicArticle
}

export function ArticleAbstractSection({
  article,
}: ArticleAbstractSectionProps) {
  return (
    <section aria-labelledby="abstract-title">
      <h2
        id="abstract-title"
        className="text-2xl font-semibold tracking-tight text-foreground"
      >
        Abstract
      </h2>
      {article.abstract ? (
        <p
          className="mt-4 whitespace-pre-line text-base leading-8 text-text-secondary"
          dir="auto"
        >
          {article.abstract}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          No abstract has been published for this article.
        </p>
      )}
    </section>
  )
}
