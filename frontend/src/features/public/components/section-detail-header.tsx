import Link from "next/link";
import type { PublicArticle, PublicSection } from "../types";
import { formatArticleDate } from "../utils/article-details";
import { getSectionKeywords } from "../utils/public-sections";

type SectionDetailHeaderProps = {
  section: PublicSection;
  articles: PublicArticle[];
};

export function SectionDetailHeader({
  section,
  articles,
}: SectionDetailHeaderProps) {
  const latestArticle = articles[0];
  const keywords = getSectionKeywords(section);

  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Link
          href="/sections"
          className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
        >
          ← Back to sections
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Journal Section
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {section.name}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {section.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {section.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border bg-slate-50 p-6">
            <h2 className="text-lg font-bold text-slate-950">
              Section Summary
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-medium text-slate-500">
                  Published Articles
                </dt>
                <dd className="mt-1 text-2xl font-bold text-slate-950">
                  {articles.length}
                </dd>
              </div>

              {latestArticle ? (
                <div>
                  <dt className="font-medium text-slate-500">Latest Update</dt>
                  <dd className="mt-1 text-slate-950">
                    {formatArticleDate(latestArticle.publishedAt)}
                  </dd>
                </div>
              ) : null}

              {keywords.length > 0 ? (
                <div>
                  <dt className="font-medium text-slate-500">
                    Frequent Keywords
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {keywords.slice(0, 5).map((keyword) => (
                      <Link
                        key={keyword}
                        href={`/articles?search=${encodeURIComponent(keyword)}`}
                        className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                      >
                        {keyword}
                      </Link>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </div>
    </section>
  );
}
