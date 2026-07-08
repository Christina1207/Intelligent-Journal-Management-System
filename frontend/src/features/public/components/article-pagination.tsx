import Link from "next/link";
import type { ArticleSearchParams } from "../utils/article-search";

type ArticlePaginationProps = {
  currentPage: number;
  totalPages: number;
  params: ArticleSearchParams;
};

function buildPageHref(params: ArticleSearchParams, page: number) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value || value === "all") {
      return;
    }

    if (key === "page") {
      return;
    }

    searchParams.set(key, value);
  });

  if (page > 1) {
    searchParams.set("page", page.toString());
  }

  const queryString = searchParams.toString();

  return queryString ? `/articles?${queryString}` : "/articles";
}

export function ArticlePagination({
  currentPage,
  totalPages,
  params,
}: ArticlePaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = currentPage - 1;
  const nextPage = currentPage + 1;

  return (
    <nav
      className="mt-10 flex items-center justify-between border-t pt-6"
      aria-label="Article pagination"
    >
      <div>
        {currentPage > 1 ? (
          <Link
            href={buildPageHref(params, previousPage)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Previous
          </Link>
        ) : (
          <span className="rounded-md border px-4 py-2 text-sm font-medium text-slate-300">
            Previous
          </span>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Page <span className="font-medium text-slate-950">{currentPage}</span>{" "}
        of <span className="font-medium text-slate-950">{totalPages}</span>
      </p>

      <div>
        {currentPage < totalPages ? (
          <Link
            href={buildPageHref(params, nextPage)}
            className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Next
          </Link>
        ) : (
          <span className="rounded-md border px-4 py-2 text-sm font-medium text-slate-300">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
