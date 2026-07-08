import Link from "next/link";
import type { PublicArticle } from "../types";
import { formatArticleDate } from "../utils/article-details";

type ArticleDetailHeaderProps = {
  article: PublicArticle;
};

export function ArticleDetailHeader({ article }: ArticleDetailHeaderProps) {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Link
          href="/articles"
          className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          ← Back to articles
        </Link>

        <div className="mt-8 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
            <span>{article.section}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt}>
              Published {formatArticleDate(article.publishedAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>{article.language}</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
            {article.title}
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            {article.authors.join(", ")}
          </p>

          {article.affiliations && article.affiliations.length > 0 ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {article.affiliations.join(" · ")}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {article.keywords.map((keyword) => (
              <Link
                key={keyword}
                href={`/articles?search=${encodeURIComponent(keyword)}`}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              >
                {keyword}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
