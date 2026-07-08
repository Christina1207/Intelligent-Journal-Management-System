import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { PublicSectionCard } from "../components/public-section-card";
import { SectionArticlesSection } from "../components/section-articles-section";
import { SectionDetailHeader } from "../components/section-detail-header";
import { journalInfo } from "../data/public-home.mock";
import type { PublicArticle, PublicSection } from "../types";
import { getRelatedSections } from "../utils/public-sections";

type PublicSectionDetailsPageProps = {
  section: PublicSection;
  articles: PublicArticle[];
};

export function PublicSectionDetailsPage({
  section,
  articles,
}: PublicSectionDetailsPageProps) {
  const relatedSections = getRelatedSections(section);

  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <SectionDetailHeader section={section} articles={articles} />

        <SectionArticlesSection section={section} articles={articles} />

        {relatedSections.length > 0 ? (
          <section
            className="border-t bg-white py-12 sm:py-16"
            aria-labelledby="related-sections-title"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Explore More
              </p>

              <h2
                id="related-sections-title"
                className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
              >
                Other Journal Sections
              </h2>

              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {relatedSections.map((relatedSection) => (
                  <PublicSectionCard
                    key={relatedSection.id}
                    section={relatedSection}
                  />
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
