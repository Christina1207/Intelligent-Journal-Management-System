import { LibraryBig } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/section-header"
import { buttonVariants } from "@/components/ui/button"

import type { PublicArticle, PublicIssue } from "../types"
import { ArticleCard } from "./article-card"
import { ArticlePagination } from "./article-pagination"

type IssueArticlesSectionProps = {
  issue: PublicIssue
  articles: PublicArticle[]
  currentPage: number
  totalPages: number
}

export function IssueArticlesSection({
  issue,
  articles,
  currentPage,
  totalPages,
}: IssueArticlesSectionProps) {
  return (
    <section className="py-10 sm:py-12" aria-labelledby="issue-articles-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          titleId="issue-articles-title"
          title="Issue contents"
          description={`Articles published in ${issue.title}.`}
          action={
            <Link
              href="/archives"
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              All issues
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
              basePath={`/issues/${issue.slug}`}
            />
          </>
        ) : (
          <EmptyState
            className="mt-6"
            icon={<LibraryBig aria-hidden="true" />}
            title="No public articles in this issue"
            description="Issue contents will appear here when articles are published."
          />
        )}
      </div>
    </section>
  )
}
