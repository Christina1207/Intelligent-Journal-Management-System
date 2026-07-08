import Link from "next/link";
import type { PublicArticle, PublicIssue } from "../types";
import { ArticleCard } from "./article-card";

type IssueArticlesSectionProps = {
  issue: PublicIssue;
  articles: PublicArticle[];
};

export function IssueArticlesSection({
  issue,
  articles,
}: IssueArticlesSectionProps) {
  return (
    <section className="py-12 sm:py-16" aria-labelledby="issue-articles-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Issue Contents
            </p>

            <h2
              id="issue-articles-title"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
            >
              Articles in {issue.title}
            </h2>

            <p className="mt-3 max-w-2xl text-slate-600">
              Browse all articles published in this issue.
            </p>
          </div>

          <Link
            href="/articles"
            className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
          >
            Browse all articles
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border bg-white p-10 text-center shadow-sm">
            <h3 className="text-lg font-semibold text-slate-950">
              No articles in this issue yet
            </h3>

            <p className="mt-2 text-sm text-slate-600">
              This issue does not currently contain public articles.
            </p>

            <Link
              href="/archives"
              className="mt-5 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Back to Archives
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
