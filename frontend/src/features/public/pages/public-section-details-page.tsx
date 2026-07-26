import { SectionHeader } from "@/components/common/section-header"

import { PublicSectionCard } from "../components/public-section-card"
import { SectionArticlesSection } from "../components/section-articles-section"
import { SectionDetailHeader } from "../components/section-detail-header"
import type { PublicArticle, PublicSection } from "../types"

type PublicSectionDetailsPageProps = {
  section: PublicSection
  articles: PublicArticle[]
  articleCount: number
  currentPage: number
  totalPages: number
  relatedSections: PublicSection[]
}

export function PublicSectionDetailsPage({
  section,
  articles,
  articleCount,
  currentPage,
  totalPages,
  relatedSections,
}: PublicSectionDetailsPageProps) {
  return (
    <>
      <SectionDetailHeader section={section} articleCount={articleCount} />
      <SectionArticlesSection
        section={section}
        articles={articles}
        currentPage={currentPage}
        totalPages={totalPages}
      />

      {relatedSections.length > 0 ? (
        <section
          className="border-t border-border bg-surface-muted/45 py-10 sm:py-12"
          aria-labelledby="related-sections-title"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              titleId="related-sections-title"
              title="Other journal sections"
              description="Continue exploring the journal by discipline."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {relatedSections.map((relatedSection) => (
                <PublicSectionCard
                  key={relatedSection.id}
                  section={relatedSection}
                  compact
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
