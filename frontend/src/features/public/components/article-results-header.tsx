import type { ArticleSearchParams } from "../utils/article-search"

type ArticleResultsHeaderProps = {
  totalResults: number
  params: ArticleSearchParams
}

export function ArticleResultsHeader({
  totalResults,
  params,
}: ArticleResultsHeaderProps) {
  const hasSearch = Boolean(params.search?.trim())

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        Research library
      </p>
      <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl">
        Published articles
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        {hasSearch ? (
          <>
            {totalResults} result{totalResults === 1 ? "" : "s"} for{" "}
            <span className="font-medium text-foreground" dir="auto">
              “{params.search}”
            </span>
          </>
        ) : (
          <>
            {totalResults} published article{totalResults === 1 ? "" : "s"}{" "}
            available to browse.
          </>
        )}
      </p>
    </div>
  )
}
