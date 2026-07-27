import { ArrowRight, LayoutList } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/section-header"
import { buttonVariants } from "@/components/ui/button"

import type { PublicSection } from "../types"
import { PublicSectionCard } from "./public-section-card"

type BrowseSectionsSectionProps = {
  sections: PublicSection[]
}

export function BrowseSectionsSection({
  sections,
}: BrowseSectionsSectionProps) {
  return (
    <section className="bg-background py-12 sm:py-16" aria-labelledby="sections-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          titleId="sections-title"
          title="Browse by section"
          description="Explore published research by journal discipline and subject area."
          action={
            <Link
              href="/sections"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              All sections
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
          }
        />
        {sections.length > 0 ? (
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sections.slice(0, 6).map((section) => (
              <PublicSectionCard key={section.id} section={section} compact />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-7"
            icon={<LayoutList aria-hidden="true" />}
            title="No journal sections available"
            description="Active journal sections will appear here when configured."
          />
        )}
      </div>
    </section>
  )
}
