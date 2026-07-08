import type { PublicArticle } from "../types";
import { ArticleCard } from "./article-card";

type ArticleRelatedSectionProps = {
  articles: PublicArticle[];
};

export function ArticleRelatedSection({
  articles,
}: ArticleRelatedSectionProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="mt-10" aria-labelledby="related-articles-title">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Continue Reading
        </p>

        <h2
          id="related-articles-title"
          className="mt-2 text-2xl font-bold text-slate-950"
        >
          Related Articles
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
