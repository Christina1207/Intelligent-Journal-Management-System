import { Search, SlidersHorizontal, X } from "lucide-react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"

import type { PublicSection } from "../types"
import type { ArticleSearchParams } from "../utils/article-search"

type ArticleSearchFiltersProps = {
  sections: PublicSection[]
  years: string[]
  params: ArticleSearchParams
}

function buildFilterRemovalHref(
  params: ArticleSearchParams,
  keyToRemove: keyof ArticleSearchParams
) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (
      key === keyToRemove ||
      key === "page" ||
      !value ||
      value === "all" ||
      (key === "sort" && value === "newest")
    ) {
      return
    }

    query.set(key, value)
  })

  const queryString = query.toString()
  return queryString ? `/articles?${queryString}` : "/articles"
}

export function ArticleSearchFilters({
  sections,
  years,
  params,
}: ArticleSearchFiltersProps) {
  const activeFilters = [
    params.search?.trim()
      ? {
          key: "search" as const,
          label: `Search: ${params.search.trim()}`,
        }
      : null,
    params.section && params.section !== "all"
      ? {
          key: "section" as const,
          label:
            sections.find((section) => section.slug === params.section)?.name ??
            params.section,
        }
      : null,
    params.year && params.year !== "all"
      ? { key: "year" as const, label: params.year }
      : null,
    params.language && params.language !== "all"
      ? { key: "language" as const, label: params.language }
      : null,
    params.sort && params.sort !== "newest"
      ? {
          key: "sort" as const,
          label: `Sort: ${params.sort.replaceAll("_", " ")}`,
        }
      : null,
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <form action="/articles" method="GET" role="search">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
          <Label htmlFor="article-search">Search published research</Label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="article-search"
                name="search"
                type="search"
                defaultValue={params.search ?? ""}
                placeholder="Title, author, abstract, keyword, or DOI"
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="accent" size="touch">
              <Search data-icon="inline-start" aria-hidden="true" />
              Search
            </Button>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-border/70 pt-4 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />
            Refine results
          </div>

          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="section-filter">Section</Label>
              <Select
                id="section-filter"
                name="section"
                defaultValue={params.section ?? "all"}
              >
                <option value="all">All sections</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.slug}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="year-filter">Year</Label>
              <Select
                id="year-filter"
                name="year"
                defaultValue={params.year ?? "all"}
              >
                <option value="all">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="language-filter">Language</Label>
              <Select
                id="language-filter"
                name="language"
                defaultValue={params.language ?? "all"}
              >
                <option value="all">All languages</option>
                <option value="English">English</option>
                <option value="Arabic">Arabic</option>
                <option value="French">French</option>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sort-filter">Sort by</Label>
              <Select
                id="sort-filter"
                name="sort"
                defaultValue={params.sort ?? "newest"}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="most_viewed">Most viewed</option>
                <option value="most_downloaded">Most downloaded</option>
                <option value="title">Title A–Z</option>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" variant="default" size="touch">
              Apply filters
            </Button>
            <Link
              href="/articles"
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      {activeFilters.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Active article filters"
        >
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Active filters
          </span>
          {activeFilters.map((filter) =>
            filter ? (
              <Link
                key={filter.key}
                href={buildFilterRemovalHref(params, filter.key)}
                className="inline-flex min-h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-text-secondary hover:border-accent hover:text-foreground"
                aria-label={`Remove ${filter.label} filter`}
              >
                {filter.label}
                <X className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null
          )}
        </div>
      ) : null}
    </div>
  )
}
