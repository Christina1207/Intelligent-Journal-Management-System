import { Archive } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"

import { ArchiveOverviewHeader } from "../components/archive-overview-header"
import { IssueCard } from "../components/issue-card"
import type { PublicIssue } from "../types"

type PublicArchivesPageProps = {
  issues: PublicIssue[]
}

function groupIssuesByYear(issues: PublicIssue[]) {
  const grouped = new Map<string, PublicIssue[]>()

  issues.forEach((issue) => {
    const year = issue.year || "Other"
    grouped.set(year, [...(grouped.get(year) ?? []), issue])
  })

  return Array.from(grouped.entries())
    .sort(([firstYear], [secondYear]) => Number(secondYear) - Number(firstYear))
    .map(([year, yearIssues]) => ({
      year,
      issues: yearIssues.sort(
        (first, second) =>
          new Date(second.publishedAt).getTime() -
          new Date(first.publishedAt).getTime()
      ),
    }))
}

export function PublicArchivesPage({ issues }: PublicArchivesPageProps) {
  const groupedIssues = groupIssuesByYear(issues)

  return (
    <>
      <ArchiveOverviewHeader
        issueCount={issues.length}
        yearCount={groupedIssues.length}
      />

      <section className="py-10 sm:py-12" aria-labelledby="archives-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="archives-title" className="sr-only">
            Archived journal issues
          </h2>

          {groupedIssues.length > 0 ? (
            <div className="space-y-10">
              {groupedIssues.map((group) => (
                <section key={group.year} aria-labelledby={`year-${group.year}`}>
                  <div className="mb-4 flex items-center gap-4">
                    <h2
                      id={`year-${group.year}`}
                      className="text-2xl font-semibold text-foreground"
                    >
                      {group.year}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {group.issues.length} issue
                      {group.issues.length === 1 ? "" : "s"}
                    </span>
                    <div className="h-px flex-1 bg-border" aria-hidden="true" />
                  </div>
                  <div className="grid gap-3">
                    {group.issues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Archive aria-hidden="true" />}
              title="No published issues"
              description="Journal issues will appear here when they are published."
            />
          )}
        </div>
      </section>
    </>
  )
}
