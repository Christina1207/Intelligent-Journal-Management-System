import Link from "next/link";
import type { PublicArticle, PublicSection } from "../types";
import { ArticleCard } from "./article-card";

type SectionArticlesSectionProps = {
  section: PublicSection;
  articles: PublicArticle[];
};

export function SectionArticlesSection({
  section,
  articles,
}: SectionArticlesSectionProps) {
  return (
    <section
      className="py-12 sm:py-16"
      aria-labelledby="section-articles-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Published Articles
            </p>

            <h2
              id="section-articles-title"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
            >
              Articles in {section.name}
            </h2>

            <p className="mt-3 max-w-2xl text-slate-600">
              Browse peer-reviewed articles published under this journal
              section.
            </p>
          </div>

          <Link
            href={`/articles?section=${section.slug}`}
            className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
          >
            Open in article search
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">
              No published articles yet
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This section does not have public published articles at the
              moment.
            </p>

            <Link
              href="/articles"
              className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Browse All Articles
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
