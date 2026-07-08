import Link from "next/link";
import type { PublicArticle } from "../types";
import { ArticleCard } from "./article-card";

type LatestArticlesSectionProps = {
  articles: PublicArticle[];
};

export function LatestArticlesSection({
  articles,
}: LatestArticlesSectionProps) {
  return (
    <section className="bg-white py-16 sm:py-20" aria-labelledby="latest-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Published Research
            </p>
            <h2
              id="latest-title"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
            >
              Latest Articles
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Browse recently published peer-reviewed articles across journal
              sections.
            </p>
          </div>

          <Link
            href="/articles"
            className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
          >
            View all articles
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  );
}
