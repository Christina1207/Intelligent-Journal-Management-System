import Link from "next/link";

type ArchiveOverviewHeaderProps = {
  issueCount: number;
  articleCount: number;
  yearCount: number;
};

export function ArchiveOverviewHeader({
  issueCount,
  articleCount,
  yearCount,
}: ArchiveOverviewHeaderProps) {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Journal Archives
        </p>

        <div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
              Browse published issues and archives.
            </h1>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Explore current and previous journal issues, grouped by
              publication year.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[28rem]">
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-3xl font-bold text-slate-950">{issueCount}</p>
              <p className="mt-1 text-sm text-slate-600">Issues</p>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-3xl font-bold text-slate-950">
                {articleCount}
              </p>
              <p className="mt-1 text-sm text-slate-600">Articles</p>
            </div>

            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-3xl font-bold text-slate-950">{yearCount}</p>
              <p className="mt-1 text-sm text-slate-600">Years</p>
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
            href="/sections"
            className="rounded-md border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Browse Sections
          </Link>
        </div>
      </div>
    </section>
  );
}
