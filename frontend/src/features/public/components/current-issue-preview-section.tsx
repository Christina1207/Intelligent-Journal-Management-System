import Link from "next/link";
import type { PublicArticle, PublicIssue } from "../types";
import { formatArticleDate } from "../utils/article-details";
import { ArticleCard } from "./article-card";

type CurrentIssuePreviewSectionProps = {
  issue: PublicIssue;
  articles: PublicArticle[];
};

export function CurrentIssuePreviewSection({
  issue,
  articles,
}: CurrentIssuePreviewSectionProps) {
  return (
    <section
      className="border-y bg-slate-50 py-16 sm:py-20"
      aria-labelledby="current-issue-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border bg-white p-6 shadow-sm">
            <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              Current Issue
            </span>

            <h2
              id="current-issue-title"
              className="mt-4 text-3xl font-bold tracking-tight text-slate-950"
            >
              {issue.title}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Published {formatArticleDate(issue.publishedAt)}
            </p>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              {issue.description}
            </p>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
              <div>
                <dt className="text-slate-500">Volume</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {issue.volume}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Issue</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {issue.issue}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={`/issues/${issue.slug}`}
                className="rounded-md bg-slate-950 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Current Issue
              </Link>

              <Link
                href="/archives"
                className="rounded-md border px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Browse Archives
              </Link>
            </div>
          </aside>

          <div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Featured in this Issue
                </p>

                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  Recently Published
                </h3>
              </div>

              <Link
                href={`/issues/${issue.slug}`}
                className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
              >
                View all issue articles
              </Link>
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {articles.slice(0, 2).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
