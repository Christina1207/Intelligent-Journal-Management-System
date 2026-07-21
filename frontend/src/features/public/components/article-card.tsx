import Link from "next/link";
import type { PublicArticle } from "../types";
import { ArticleCardDownloadButton } from "./article-card-download-button";

type ArticleCardProps = {
  article: PublicArticle;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function ArticleCard({ article }: ArticleCardProps) {
  const publishedDate = dateFormatter.format(new Date(article.publishedAt));

  return (
    <article className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <span>{article.section}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={article.publishedAt}>{publishedDate}</time>
        <span aria-hidden="true">·</span>
        <span>{article.language}</span>
      </div>

      <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">
        <Link
          href={`/articles/${article.slug}`}
          className="transition hover:text-slate-700"
        >
          {article.title}
        </Link>
      </h3>

      <p className="mt-2 text-sm text-slate-600">
        {article.authors.join(", ")}
      </p>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
        {article.abstract}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {article.keywords.slice(0, 4).map((keyword) => (
          <span
            key={keyword}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          {article.doi ? <span>DOI: {article.doi}</span> : <span>No DOI</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/articles/${article.slug}`}
            className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            View Article
          </Link>

          <ArticleCardDownloadButton slug={article.slug} />
        </div>
      </div>
    </article>
  );
}
