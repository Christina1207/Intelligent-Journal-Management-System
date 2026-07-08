import Link from "next/link";
import type { PublicArticle, PublicIssue } from "../types";
import { formatArticleDate } from "../utils/article-details";

type IssueDetailHeaderProps = {
  issue: PublicIssue;
  articles: PublicArticle[];
};

export function IssueDetailHeader({ issue, articles }: IssueDetailHeaderProps) {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Link
          href="/archives"
          className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          ← Back to archives
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {issue.isCurrent ? (
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                  Current Issue
                </span>
              ) : null}

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {issue.year}
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {issue.title}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {issue.description}
            </p>
          </div>

          <aside className="rounded-2xl border bg-slate-50 p-6">
            <h2 className="text-lg font-bold text-slate-950">Issue Metadata</h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">Volume</dt>
                <dd className="mt-1 text-slate-950">{issue.volume}</dd>
              </div>

              <div>
                <dt className="font-medium text-slate-500">Issue</dt>
                <dd className="mt-1 text-slate-950">{issue.issue}</dd>
              </div>

              <div>
                <dt className="font-medium text-slate-500">Published</dt>
                <dd className="mt-1 text-slate-950">
                  {formatArticleDate(issue.publishedAt)}
                </dd>
              </div>

              <div>
                <dt className="font-medium text-slate-500">Articles</dt>
                <dd className="mt-1 text-2xl font-bold text-slate-950">
                  {articles.length}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
