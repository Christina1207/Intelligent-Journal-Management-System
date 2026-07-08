import { IssueArticlesSection } from "../components/issue-articles-section";
import { IssueCard } from "../components/issue-card";
import { IssueDetailHeader } from "../components/issue-detail-header";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import type { PublicArticle, PublicIssue } from "../types";
import { getPreviousIssues } from "../utils/public-issues";

type PublicIssueDetailsPageProps = {
  issue: PublicIssue;
  articles: PublicArticle[];
};

export function PublicIssueDetailsPage({
  issue,
  articles,
}: PublicIssueDetailsPageProps) {
  const previousIssues = getPreviousIssues(issue);

  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <IssueDetailHeader issue={issue} articles={articles} />

        <IssueArticlesSection issue={issue} articles={articles} />

        {previousIssues.length > 0 ? (
          <section
            className="border-t bg-white py-12 sm:py-16"
            aria-labelledby="previous-issues-title"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                More Archives
              </p>

              <h2
                id="previous-issues-title"
                className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
              >
                Other Issues
              </h2>

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {previousIssues.map((previousIssue) => (
                  <IssueCard key={previousIssue.id} issue={previousIssue} />
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
