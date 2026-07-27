import Link from "next/link"

import { PageHeader } from "@/components/common/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"

import type { PublicSection } from "../types"
import { PublicBreadcrumbs } from "./public-breadcrumbs"

type SectionDetailHeaderProps = {
  section: PublicSection
  articleCount: number
}

export function SectionDetailHeader({
  section,
  articleCount,
}: SectionDetailHeaderProps) {
  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          eyebrow="Journal section"
          title={section.name}
          description={
            <div>
              {section.description ? (
                <p dir="auto">{section.description}</p>
              ) : null}
              <p className={section.description ? "mt-2" : undefined}>
                {articleCount} published article
                {articleCount === 1 ? "" : "s"}
              </p>
              {section.topics.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {section.topics.map((topic) => (
                    <Badge key={topic} variant="secondary" dir="auto">
                      {topic}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          }
          breadcrumbs={
            <PublicBreadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Sections", href: "/sections" },
                { label: section.name },
              ]}
            />
          }
          actions={
            <Link
              href={`/articles?section=${section.slug}`}
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              Search this section
            </Link>
          }
        />
      </div>
    </div>
  )
}
