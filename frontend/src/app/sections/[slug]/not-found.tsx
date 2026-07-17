import Link from "next/link";
import { PublicFooter } from "@/features/public/components/public-footer";
import { PublicHeader } from "@/features/public/components/public-header";
import { getPublicJournalSafe } from "@/features/public/api/public-api";

export default async function SectionNotFoundPage() {
  const journal = await getPublicJournalSafe();
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Section Not Found
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            We could not find this journal section.
          </h1>

          <p className="mt-4 text-slate-600">
            The section may have been renamed, removed, or the link may be
            incorrect.
          </p>

          <Link
            href="/sections"
            className="mt-8 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Browse Sections
          </Link>
        </div>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
