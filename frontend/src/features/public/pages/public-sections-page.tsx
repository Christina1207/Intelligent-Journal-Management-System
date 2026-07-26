import { LayoutList } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"

import { PublicSectionCard } from "../components/public-section-card"
import { SectionsOverviewHeader } from "../components/sections-overview-header"
import type { PublicSection } from "../types"

type PublicSectionsPageProps = {
  sections: PublicSection[]
  articleCount: number
}

export function PublicSectionsPage({
  sections,
  articleCount,
}: PublicSectionsPageProps) {
  return (
    <>
      <SectionsOverviewHeader
        sectionCount={sections.length}
        articleCount={articleCount}
      />

      <section className="py-10 sm:py-12" aria-labelledby="sections-list-title">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="sections-list-title" className="sr-only">
            Available journal sections
          </h2>

          {sections.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section) => (
                <PublicSectionCard key={section.id} section={section} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<LayoutList aria-hidden="true" />}
              title="No active sections"
              description="Journal sections will appear here when they are configured for public access."
            />
          )}
        </div>
      </section>
    </>
  )
}
