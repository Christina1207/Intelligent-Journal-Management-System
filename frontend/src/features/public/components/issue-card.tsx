import Link from "next/link";
import type { PublicIssue } from "../types";
import { formatArticleDate } from "../utils/article-details";

type IssueCardProps = {
  issue: PublicIssue;
};

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <article className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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

      <h2 className="mt-4 text-xl font-bold text-slate-950">
        <Link
          href={`/issues/${issue.slug}`}
          className="transition hover:text-slate-700"
        >
          {issue.title}
        </Link>
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Published {formatArticleDate(issue.publishedAt)}
      </p>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        {issue.description}
      </p>

      {issue.volume || issue.issue ? (
        <div className="mt-5 border-t pt-5">
          <p className="text-sm text-slate-600">
            {issue.volume ? `Volume ${issue.volume}` : null}
            {issue.volume && issue.issue ? " · " : null}
            {issue.issue ? `Issue ${issue.issue}` : null}
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <Link
          href={`/issues/${issue.slug}`}
          className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          View Issue
        </Link>
      </div>
    </article>
  );
}
