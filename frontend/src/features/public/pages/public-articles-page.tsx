import { SearchX } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { buttonVariants } from "@/components/ui/button"

import { ArticleCard } from "../components/article-card"
import { ArticlePagination } from "../components/article-pagination"
import { ArticleResultsHeader } from "../components/article-results-header"
import { ArticleSearchFilters } from "../components/article-search-filters"
import { PublicBreadcrumbs } from "../components/public-breadcrumbs"
import type { PublicArticle, PublicSection } from "../types"
import type { ArticleSearchParams } from "../utils/article-search"

type PublicArticlesPageProps = {
  articles: PublicArticle[]
  totalResults: number
  currentPage: number
  totalPages: number
  sections: PublicSection[]
  years: string[]
  searchParams: ArticleSearchParams
}

export function PublicArticlesPage({
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
      <section className="border-b border-border bg-surface-elevated">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Articles" },
            ]}
          />
          <div className="mt-6">
            <ArticleResultsHeader
              totalResults={totalResults}
              params={searchParams}
            />
          </div>
          <div className="mt-7">
            <ArticleSearchFilters
              sections={sections}
              years={years}
              params={searchParams}
            />
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-12" aria-labelledby="article-results-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="article-results-title" className="sr-only">
            Article results
          </h2>

          {articles.length > 0 ? (
            <>
              <div className="grid gap-4">
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
            <EmptyState
              icon={<SearchX aria-hidden="true" />}
              title="No articles match these filters"
              description="Change the search terms or remove one or more filters."
              action={
                <Link
                  href="/articles"
                  className={buttonVariants({
                    variant: "outline",
                    size: "touch",
                  })}
                >
                  Clear all filters
                </Link>
              }
            />
          )}
        </div>
      </section>
    </>
  )
}
