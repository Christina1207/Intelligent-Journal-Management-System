import Link from "next/link";
import type { PublicSection } from "../types";

type PublicSectionCardProps = {
  section: PublicSection;
};

export function PublicSectionCard({ section }: PublicSectionCardProps) {
  return (
    <article className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950">
            <Link
              href={`/sections/${section.slug}`}
              className="transition hover:text-slate-700"
            >
              {section.name}
            </Link>
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {section.description}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {section.articleCount} article{section.articleCount === 1 ? "" : "s"}
        </span>
      </div>

      {section.topics.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {section.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full border px-3 py-1 text-xs font-medium text-slate-600"
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <Link
          href={`/sections/${section.slug}`}
          className="inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Browse Section
        </Link>
      </div>
    </article>
  );
}
