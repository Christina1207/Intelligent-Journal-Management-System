import { BookOpenText, ArrowRight } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/section-header"
import { buttonVariants } from "@/components/ui/button"

import type { PublicArticle } from "../types"
import { ArticleCard } from "./article-card"

type LatestArticlesSectionProps = {
  articles: PublicArticle[]
}

export function LatestArticlesSection({
  articles,
}: LatestArticlesSectionProps) {
  return (
    <section className="bg-background py-12 sm:py-16" aria-labelledby="latest-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          titleId="latest-title"
          title="Latest published articles"
          description="Recently published research from across the journal."
          action={
            <Link
              href="/articles"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              View all articles
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          }
        />
        {articles.length > 0 ? (
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} compact />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-7"
            icon={<BookOpenText aria-hidden="true" />}
            title="No published articles yet"
            description="Published research will appear here when it becomes available."
          />
        )}
      </div>
    </section>
  )
}
