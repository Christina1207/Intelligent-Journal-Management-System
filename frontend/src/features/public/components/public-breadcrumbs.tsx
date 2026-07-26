import { ChevronRight } from "lucide-react"
import Link from "next/link"

type PublicBreadcrumbItem = {
  label: string
  href?: string
}

interface PublicBreadcrumbsProps {
  items: PublicBreadcrumbItem[]
}

export function PublicBreadcrumbs({ items }: PublicBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const current = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3.5" aria-hidden="true" />
              ) : null}
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={current ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export type { PublicBreadcrumbItem }
