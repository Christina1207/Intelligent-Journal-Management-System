import { ArticleAbstractSection } from "../components/article-abstract-section";
import { ArticleActionPanel } from "../components/article-action-panel";
import { ArticleDetailHeader } from "../components/article-detail-header";
import { ArticleMetadataCard } from "../components/article-metadata-card";
import { ArticleRelatedSection } from "../components/article-related-section";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type { JournalInfo, PublicArticle } from "../types";

type PublicArticleDetailsPageProps = {
  journal: JournalInfo;
  article: PublicArticle;
  relatedArticles: PublicArticle[];
};

export function PublicArticleDetailsPage({
  journal,
  article,
  relatedArticles,
}: PublicArticleDetailsPageProps) {
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <ArticleDetailHeader article={article} />

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <div>
            <ArticleAbstractSection article={article} />

            <section
              className="mt-8 rounded-2xl border bg-white p-6 shadow-sm"
              aria-labelledby="keywords-title"
            >
              <h2
                id="keywords-title"
                className="text-2xl font-bold text-slate-950"
              >
                Keywords
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {article.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <ArticleActionPanel article={article} />
            <ArticleMetadataCard article={article} />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
          <ArticleRelatedSection articles={relatedArticles} />
        </div>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
