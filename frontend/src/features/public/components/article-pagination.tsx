import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { ArticleSearchParams } from "../utils/article-search"

type ArticlePaginationProps = {
  currentPage: number
  totalPages: number
  params?: ArticleSearchParams
  basePath?: string
}

function buildPageHref(
  params: ArticleSearchParams,
  page: number,
  basePath: string
) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (!value || value === "all" || key === "page") {
      return
    }

    searchParams.set(key, value)
  })

  if (page > 1) {
    searchParams.set("page", page.toString())
  }

  const queryString = searchParams.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

function getVisiblePages(currentPage: number, totalPages: number) {
  return Array.from(
    new Set([
      1,
      totalPages,
      currentPage - 1,
      currentPage,
      currentPage + 1,
    ])
  )
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second)
}

export function ArticlePagination({
  currentPage,
  totalPages,
  params = {},
  basePath = "/articles",
}: ArticlePaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  const pages = getVisiblePages(currentPage, totalPages)

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6"
      aria-label="Article pagination"
    >
      {currentPage > 1 ? (
        <Link
          href={buildPageHref(params, currentPage - 1, basePath)}
          className={buttonVariants({ variant: "outline", size: "touch" })}
          rel="prev"
        >
          <ChevronLeft data-icon="inline-start" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "touch" }),
            "cursor-not-allowed opacity-45"
          )}
          aria-disabled="true"
        >
          <ChevronLeft data-icon="inline-start" aria-hidden="true" />
          Previous
        </span>
      )}

      <ol className="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
        {pages.map((page, index) => {
          const previousPage = pages[index - 1]
          const showGap = previousPage && page - previousPage > 1

          return (
            <li key={page} className="flex items-center gap-1">
              {showGap ? (
                <span className="px-1 text-muted-foreground" aria-hidden="true">
                  …
                </span>
              ) : null}
              <Link
                href={buildPageHref(params, page, basePath)}
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Page ${page}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-touch" }),
                  page === currentPage &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                {page}
              </Link>
            </li>
          )
        })}
      </ol>

      {currentPage < totalPages ? (
        <Link
          href={buildPageHref(params, currentPage + 1, basePath)}
          className={buttonVariants({ variant: "outline", size: "touch" })}
          rel="next"
        >
          Next
          <ChevronRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      ) : (
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "touch" }),
            "cursor-not-allowed opacity-45"
          )}
          aria-disabled="true"
        >
          Next
          <ChevronRight data-icon="inline-end" aria-hidden="true" />
        </span>
      )}
    </nav>
  )
}
