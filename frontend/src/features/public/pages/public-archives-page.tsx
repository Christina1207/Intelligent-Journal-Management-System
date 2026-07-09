import { ArchiveOverviewHeader } from "../components/archive-overview-header";
import { IssueCard } from "../components/issue-card";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type { JournalInfo, PublicIssue } from "../types";

type PublicArchivesPageProps = {
  journal: JournalInfo;
  issues: PublicIssue[];
  articleCount: number;
};

function groupIssuesByYear(issues: PublicIssue[]) {
  const grouped = new Map<string, PublicIssue[]>();

  issues.forEach((issue) => {
    grouped.set(issue.year, [...(grouped.get(issue.year) ?? []), issue]);
  });

  return Array.from(grouped.entries())
    .sort(([firstYear], [secondYear]) => Number(secondYear) - Number(firstYear))
    .map(([year, yearIssues]) => ({
      year,
      issues: yearIssues.sort(
        (first, second) =>
          new Date(second.publishedAt).getTime() -
          new Date(first.publishedAt).getTime(),
      ),
    }));
}

export function PublicArchivesPage({
  journal,
  issues,
  articleCount,
}: PublicArchivesPageProps) {
  const groupedIssues = groupIssuesByYear(issues);

  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <ArchiveOverviewHeader
          issueCount={issues.length}
          articleCount={articleCount}
          yearCount={groupedIssues.length}
        />

        <section className="py-12 sm:py-16" aria-labelledby="archives-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="archives-title" className="sr-only">
              Archived journal issues
            </h2>

            <div className="space-y-12">
              {groupedIssues.map((group) => (
                <section
                  key={group.year}
                  aria-labelledby={`year-${group.year}`}
                >
                  <div className="mb-6 flex items-center gap-4">
                    <h3
                      id={`year-${group.year}`}
                      className="text-2xl font-bold text-slate-950"
                    >
                      {group.year}
                    </h3>

                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    {group.issues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
