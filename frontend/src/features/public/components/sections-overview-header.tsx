import Link from "next/link"

import { PageHeader } from "@/components/common/page-header"
import { buttonVariants } from "@/components/ui/button"

import { PublicBreadcrumbs } from "./public-breadcrumbs"

type SectionsOverviewHeaderProps = {
  sectionCount: number
  articleCount: number
}

export function SectionsOverviewHeader({
  sectionCount,
  articleCount,
}: SectionsOverviewHeaderProps) {
  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          eyebrow="Journal sections"
          title="Browse research by section"
          description={`${sectionCount} active section${
            sectionCount === 1 ? "" : "s"
          } organizing ${articleCount} published article${
            articleCount === 1 ? "" : "s"
          }.`}
          breadcrumbs={
            <PublicBreadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Sections" },
              ]}
            />
          }
          actions={
            <Link
              href="/articles"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              Browse all articles
            </Link>
          }
        />
      </div>
    </div>
  )
}
