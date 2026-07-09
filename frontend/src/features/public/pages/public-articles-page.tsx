import { ArticleCard } from "../components/article-card";
import { ArticlePagination } from "../components/article-pagination";
import { ArticleResultsHeader } from "../components/article-results-header";
import { ArticleSearchFilters } from "../components/article-search-filters";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type { JournalInfo, PublicArticle, PublicSection } from "../types";
import type { ArticleSearchParams } from "../utils/article-search";
import Link from "next/link";

type PublicArticlesPageProps = {
  journal: JournalInfo;
  articles: PublicArticle[];
  totalResults: number;
  currentPage: number;
  totalPages: number;
  sections: PublicSection[];
  years: string[];
  searchParams: ArticleSearchParams;
};

export function PublicArticlesPage({
  journal,
  articles,
  totalResults,
  currentPage,
  totalPages,
  sections,
  years,
  searchParams,
}: PublicArticlesPageProps) {
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <section className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <ArticleResultsHeader
              totalResults={totalResults}
              params={searchParams}
            />

            <div className="mt-8">
              <ArticleSearchFilters
                sections={sections}
                years={years}
                params={searchParams}
              />
            </div>
          </div>
        </section>

        <section className="py-12" aria-labelledby="article-results-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="article-results-title" className="sr-only">
              Article results
            </h2>

            {articles.length > 0 ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  {articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>

                <ArticlePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  params={searchParams}
                />
              </>
            ) : (
              <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">
                  No articles found
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  Try changing your search terms or removing one of the filters.
                </p>

                <Link
                  href="/articles"
                  className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Clear all filters
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
