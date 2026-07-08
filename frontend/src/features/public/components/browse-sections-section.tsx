import Link from "next/link";
import type { PublicSection } from "../types";

type BrowseSectionsSectionProps = {
  sections: PublicSection[];
};

export function BrowseSectionsSection({
  sections,
}: BrowseSectionsSectionProps) {
  return (
    <section
      className="border-y bg-slate-50 py-16 sm:py-20"
      aria-labelledby="sections-title"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Explore by Discipline
            </p>
            <h2
              id="sections-title"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
            >
              Browse by Section
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Navigate published research by journal section and research area.
            </p>
          </div>

          <Link
            href="/sections"
            className="text-sm font-semibold text-slate-950 underline-offset-4 hover:underline"
          >
            View all sections
          </Link>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/sections/${section.slug}`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-slate-950">{section.name}</h3>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {section.articleCount}
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {section.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {section.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border px-2.5 py-1 text-xs text-slate-600"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
