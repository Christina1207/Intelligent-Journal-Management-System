import { ArchiveOverviewHeader } from "../components/archive-overview-header";
import { IssueCard } from "../components/issue-card";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import {
  allPublicArticles,
  journalInfo,
  publicIssues,
} from "../data/public-home.mock";
import { getIssuesGroupedByYear } from "../utils/public-issues";

export function PublicArchivesPage() {
  const groupedIssues = getIssuesGroupedByYear();

  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <ArchiveOverviewHeader
          issueCount={publicIssues.length}
          articleCount={allPublicArticles.length}
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

      <PublicFooter journal={journalInfo} />
    </>
  );
}
