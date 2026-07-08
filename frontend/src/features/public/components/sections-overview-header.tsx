import Link from "next/link";

type SectionsOverviewHeaderProps = {
  sectionCount: number;
  articleCount: number;
};

export function SectionsOverviewHeader({
  sectionCount,
  articleCount,
}: SectionsOverviewHeaderProps) {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Journal Sections
        </p>

        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Browse research by scientific section.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Explore published articles by discipline, topic, and research
              area.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:min-w-72">
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-3xl font-bold text-slate-950">
                {sectionCount}
              </p>
              <p className="mt-1 text-sm text-slate-600">Sections</p>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-3xl font-bold text-slate-950">
                {articleCount}
              </p>
              <p className="mt-1 text-sm text-slate-600">Articles</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/articles"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Browse All Articles
          </Link>

          <Link
            href="/"
            className="rounded-md border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
