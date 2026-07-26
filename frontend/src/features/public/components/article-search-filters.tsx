import Link from "next/link";
import type { PublicSection } from "../types";
import type { ArticleSearchParams } from "../utils/article-search";

type ArticleSearchFiltersProps = {
  sections: PublicSection[];
  years: string[];
  params: ArticleSearchParams;
};

export function ArticleSearchFilters({
  sections,
  years,
  params,
}: ArticleSearchFiltersProps) {
  return (
    <form
      action="/articles"
      method="GET"
      role="search"
      className="rounded-2xl border bg-white p-5 shadow-sm"
    >
      <div>
        <label
          htmlFor="article-search"
          className="text-sm font-medium text-slate-700"
        >
          Search articles
        </label>
        <input
          id="article-search"
          name="search"
          type="search"
          defaultValue={params.search ?? ""}
          placeholder="Title, author, keyword, abstract, or DOI..."
          className="mt-2 min-h-11 w-full rounded-lg border px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="section-filter"
            className="text-sm font-medium text-slate-700"
          >
            Section
          </label>
          <select
            id="section-filter"
            name="section"
            defaultValue={params.section ?? "all"}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All sections</option>
            {sections.map((section) => (
              <option key={section.id} value={section.slug}>
                {section.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="year-filter"
            className="text-sm font-medium text-slate-700"
          >
            Year
          </label>
          <select
            id="year-filter"
            name="year"
            defaultValue={params.year ?? "all"}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="language-filter"
            className="text-sm font-medium text-slate-700"
          >
            Language
          </label>
          <select
            id="language-filter"
            name="language"
            defaultValue={params.language ?? "all"}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All languages</option>
            <option value="english">English</option>
            <option value="arabic">Arabic</option>
            <option value="french">French</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="sort-filter"
            className="text-sm font-medium text-slate-700"
          >
            Sort by
          </label>
          <select
            id="sort-filter"
            name="sort"
            defaultValue={params.sort ?? "newest"}
            className="mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most_viewed">Most viewed</option>
            <option value="most_downloaded">Most downloaded</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Apply filters
        </button>

        <Link
          href="/articles"
          className="rounded-lg border px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Clear filters
        </Link>
      </div>
    </form>
  );
}
