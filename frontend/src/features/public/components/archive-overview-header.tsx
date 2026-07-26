import Link from "next/link"

import { PageHeader } from "@/components/common/page-header"
import { buttonVariants } from "@/components/ui/button"

import { PublicBreadcrumbs } from "./public-breadcrumbs"

type ArchiveOverviewHeaderProps = {
  issueCount: number
  yearCount: number
}

export function ArchiveOverviewHeader({
  issueCount,
  yearCount,
}: ArchiveOverviewHeaderProps) {
  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          eyebrow="Journal archives"
          title="Published issues"
          description={`${issueCount} issue${
            issueCount === 1 ? "" : "s"
          } across ${yearCount} publication year${
            yearCount === 1 ? "" : "s"
          }, organized chronologically.`}
          breadcrumbs={
            <PublicBreadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Archives" },
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
