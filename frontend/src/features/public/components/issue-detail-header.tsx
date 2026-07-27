import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"

import type { PublicIssue } from "../types"
import { formatArticleDate } from "../utils/article-details"
import { PublicBreadcrumbs } from "./public-breadcrumbs"

type IssueDetailHeaderProps = {
  issue: PublicIssue
  articleCount: number
}

export function IssueDetailHeader({
  issue,
  articleCount,
}: IssueDetailHeaderProps) {
  const publishedDate = formatArticleDate(issue.publishedAt)
  const metadata = [
    issue.volume ? `Volume ${issue.volume}` : null,
    issue.issue ? `Issue ${issue.issue}` : null,
    publishedDate,
    `${articleCount} article${articleCount === 1 ? "" : "s"}`,
  ].filter(Boolean)

  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          eyebrow="Journal issue"
          title={issue.title}
          description={
            <div>
              {issue.description ? <p dir="auto">{issue.description}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                {issue.isCurrent ? (
                  <Badge variant="info">Current issue</Badge>
                ) : null}
                {metadata.map((item, index) => (
                  <span key={`${item}-${index}`} className="text-muted-foreground">
                    {index > 0 ? <span className="mr-2">·</span> : null}
                    {item}
                  </span>
                ))}
              </div>
            </div>
          }
          breadcrumbs={
            <PublicBreadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Archives", href: "/archives" },
                { label: issue.title },
              ]}
            />
          }
        />
      </div>
    </div>
  )
}
