import Link from "next/link"

import { PageHeader } from "@/components/common/page-header"
import { buttonVariants } from "@/components/ui/button"

import { PublicBreadcrumbs } from "./public-breadcrumbs"

type InfoPageHeroAction = {
  label: string
  href: string
  variant?: "primary" | "secondary"
}

type InfoPageHeroProps = {
  eyebrow: string
  title: string
  description?: string
  actions?: InfoPageHeroAction[]
}

export function InfoPageHero({
  eyebrow,
  title,
  description,
  actions = [],
}: InfoPageHeroProps) {
  return (
    <div className="border-b border-border bg-surface-elevated">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          breadcrumbs={
            <PublicBreadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: eyebrow },
              ]}
            />
          }
          actions={
            actions.length > 0
              ? actions.map((action) => (
                  <Link
                    key={`${action.href}-${action.label}`}
                    href={action.href}
                    className={buttonVariants({
                      variant:
                        action.variant === "secondary"
                          ? "outline"
                          : "default",
                      size: "touch",
                    })}
                  >
                    {action.label}
                  </Link>
                ))
              : undefined
          }
        />
      </div>
    </div>
  )
}

export type { InfoPageHeroAction }
