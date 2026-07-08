import type { ArticleSearchParams } from "../utils/article-search";

type ArticleResultsHeaderProps = {
  totalResults: number;
  params: ArticleSearchParams;
};

export function ArticleResultsHeader({
  totalResults,
  params,
}: ArticleResultsHeaderProps) {
  const hasSearch = Boolean(params.search?.trim());

  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Article Database
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Browse Published Articles
        </h1>

        <p className="mt-3 text-slate-600">
          {hasSearch
            ? `Showing ${totalResults} result${
                totalResults === 1 ? "" : "s"
              } for "${params.search}".`
            : `Showing ${totalResults} published article${
                totalResults === 1 ? "" : "s"
              }.`}
        </p>
      </div>
    </div>
  );
}
