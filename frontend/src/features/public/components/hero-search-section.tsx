import Link from "next/link";
import type { JournalInfo } from "../types";

type HeroSearchSectionProps = {
  journal: JournalInfo;
};

export function HeroSearchSection({ journal }: HeroSearchSectionProps) {
  return (
    <section className="border-b bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-24">
        <div>
          <div className="mb-5 inline-flex rounded-full border bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">
            {journal.peerReviewPolicy} · {journal.accessPolicy}
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Discover peer-reviewed scientific research.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {journal.description}
          </p>

          <form
            action="/articles"
            method="GET"
            role="search"
            className="mt-8 max-w-2xl"
          >
            <label htmlFor="public-article-search" className="sr-only">
              Search articles by title, author, keyword, or DOI
            </label>

            <div className="flex flex-col gap-3 rounded-xl border bg-white p-2 shadow-sm sm:flex-row">
              <input
                id="public-article-search"
                name="search"
                type="search"
                placeholder="Search by title, author, keyword, or DOI..."
                className="min-h-12 flex-1 rounded-lg border border-transparent px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300"
              />

              <button
                type="submit"
                className="min-h-12 rounded-lg bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/sections"
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Browse Sections
            </Link>

            <Link
              href="/archives"
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View Archives
            </Link>
          </div>
        </div>

        <aside className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Journal Information
          </h2>

          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-sm font-medium text-slate-500">ISSN</dt>
              <dd className="mt-1 text-sm text-slate-950">{journal.issn}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">Publisher</dt>
              <dd className="mt-1 text-sm text-slate-950">
                {journal.publisher}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">
                Publication Model
              </dt>
              <dd className="mt-1 text-sm text-slate-950">
                {journal.publicationFrequency}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-slate-500">License</dt>
              <dd className="mt-1 text-sm text-slate-950">{journal.license}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
