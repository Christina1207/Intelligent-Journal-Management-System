import { BookOpenText } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/section-header"
import { buttonVariants } from "@/components/ui/button"

import type { PublicArticle, PublicSection } from "../types"
import { ArticleCard } from "./article-card"
import { ArticlePagination } from "./article-pagination"

type SectionArticlesSectionProps = {
  section: PublicSection
  articles: PublicArticle[]
  currentPage: number
  totalPages: number
}

export function SectionArticlesSection({
  section,
  articles,
  currentPage,
  totalPages,
}: SectionArticlesSectionProps) {
  return (
    <section
      className="py-10 sm:py-12"
      aria-labelledby="section-articles-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          titleId="section-articles-title"
          title="Published articles"
          description={`Research published in ${section.name}.`}
          action={
            <Link
              href="/articles"
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              Browse all articles
            </Link>
          }
        />

        {articles.length > 0 ? (
          <>
            <div className="mt-6 grid gap-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
            <ArticlePagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={`/sections/${section.slug}`}
            />
          </>
        ) : (
          <EmptyState
            className="mt-6"
            icon={<BookOpenText aria-hidden="true" />}
            title="No published articles yet"
            description="This section does not currently contain public articles."
            action={
              <Link
                href="/articles"
                className={buttonVariants({
                  variant: "outline",
                  size: "touch",
                })}
              >
                Browse all articles
              </Link>
            }
          />
        )}
      </div>
    </section>
  )
}
