import { SectionHeader } from "@/components/common/section-header"

import { IssueArticlesSection } from "../components/issue-articles-section"
import { IssueCard } from "../components/issue-card"
import { IssueDetailHeader } from "../components/issue-detail-header"
import type { PublicArticle, PublicIssue } from "../types"

type PublicIssueDetailsPageProps = {
  issue: PublicIssue
  articles: PublicArticle[]
  articleCount: number
  currentPage: number
  totalPages: number
  previousIssues: PublicIssue[]
}

export function PublicIssueDetailsPage({
  issue,
  articles,
  articleCount,
  currentPage,
  totalPages,
  previousIssues,
}: PublicIssueDetailsPageProps) {
  return (
    <>
      <IssueDetailHeader issue={issue} articleCount={articleCount} />
      <IssueArticlesSection
        issue={issue}
        articles={articles}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {previousIssues.length > 0 ? (
        <section
          className="border-t border-border bg-surface-muted/45 py-10 sm:py-12"
          aria-labelledby="previous-issues-title"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              titleId="previous-issues-title"
              title="More issues"
              description="Continue browsing the journal archive."
            />
            <div className="mt-6 grid gap-3">
              {previousIssues.map((previousIssue) => (
                <IssueCard key={previousIssue.id} issue={previousIssue} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
