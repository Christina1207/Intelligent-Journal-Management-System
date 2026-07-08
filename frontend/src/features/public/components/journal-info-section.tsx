import Link from "next/link";
import type { JournalInfo } from "../types";

type JournalInfoSectionProps = {
  journal: JournalInfo;
};

const trustItems = [
  "Peer-reviewed publication process",
  "Open access to published research",
  "Article metadata, DOI, and PDF access",
  "Section-based scientific organization",
];

export function JournalInfoSection({ journal }: JournalInfoSectionProps) {
  return (
    <section
      className="bg-white py-16 sm:py-20"
      aria-labelledby="journal-title"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            About the Journal
          </p>

          <h2
            id="journal-title"
            className="mt-2 text-3xl font-bold tracking-tight text-slate-950"
          >
            A public portal for scientific publishing.
          </h2>

          <p className="mt-5 leading-7 text-slate-600">
            {journal.name} provides public access to peer-reviewed articles,
            organized by section and supported by editorial and publishing
            workflows.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/about"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Learn About the Journal
            </Link>

            <Link
              href="/author-guidelines"
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Author Guidelines
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {trustItems.map((item) => (
            <div key={item} className="rounded-2xl border bg-slate-50 p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950 shadow-sm">
                ✓
              </div>

              <h3 className="font-semibold text-slate-950">{item}</h3>
            </div>
          ))}

          <div className="rounded-2xl border bg-slate-950 p-5 text-white sm:col-span-2">
            <h3 className="font-semibold">Journal Metadata</h3>

            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-300">ISSN</dt>
                <dd className="mt-1 font-medium">{journal.issn}</dd>
              </div>

              <div>
                <dt className="text-slate-300">License</dt>
                <dd className="mt-1 font-medium">{journal.license}</dd>
              </div>

              <div>
                <dt className="text-slate-300">Publisher</dt>
                <dd className="mt-1 font-medium">{journal.publisher}</dd>
              </div>

              <div>
                <dt className="text-slate-300">Access</dt>
                <dd className="mt-1 font-medium">{journal.accessPolicy}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
