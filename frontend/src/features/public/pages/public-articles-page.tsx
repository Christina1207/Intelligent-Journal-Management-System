import { ArticleCard } from "../components/article-card";
import { ArticlePagination } from "../components/article-pagination";
import { ArticleResultsHeader } from "../components/article-results-header";
import { ArticleSearchFilters } from "../components/article-search-filters";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import {
  allPublicArticles,
  journalInfo,
  publicSections,
} from "../data/public-home.mock";
import {
  getArticleYears,
  searchPublicArticles,
  type ArticleSearchParams,
} from "../utils/article-search";

type PublicArticlesPageProps = {
  searchParams: ArticleSearchParams;
};

export function PublicArticlesPage({ searchParams }: PublicArticlesPageProps) {
  const years = getArticleYears(allPublicArticles);
  const result = searchPublicArticles(allPublicArticles, searchParams);

  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <section className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <ArticleResultsHeader
              totalResults={result.totalResults}
              params={searchParams}
            />

            <div className="mt-8">
              <ArticleSearchFilters
                sections={publicSections}
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

            {result.articles.length > 0 ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  {result.articles.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>

                <ArticlePagination
                  currentPage={result.currentPage}
                  totalPages={result.totalPages}
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

                <a
                  href="/articles"
                  className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Clear all filters
                </a>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
