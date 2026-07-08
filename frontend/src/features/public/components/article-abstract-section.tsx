import type { PublicArticle } from "../types";

type ArticleAbstractSectionProps = {
  article: PublicArticle;
};

export function ArticleAbstractSection({
  article,
}: ArticleAbstractSectionProps) {
  const isArabic = article.language === "Arabic";

  return (
    <section
      className="rounded-2xl border bg-white p-6 shadow-sm"
      aria-labelledby="abstract-title"
    >
      <h2 id="abstract-title" className="text-2xl font-bold text-slate-950">
        Abstract
      </h2>

      <p
        className="mt-4 text-base leading-8 text-slate-700"
        dir={isArabic ? "rtl" : "ltr"}
      >
        {article.abstract}
      </p>
    </section>
  );
}
