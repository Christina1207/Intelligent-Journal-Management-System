import {
  ArrowLeft,
  FileCheck2,
  FilePenLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import type { JournalInfo } from "@/features/public/types";

function getJournalMark(journal: JournalInfo | null) {
  const source = journal?.shortName.trim() || journal?.name.trim() || "Journal";

  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function AuthShell({
  children,
  journal,
}: {
  children: React.ReactNode;
  journal: JournalInfo | null;
}) {
  const journalName = journal?.name.trim() || "Journal publishing portal";
  const journalShortName =
    journal?.shortName.trim() || journal?.name.trim() || "Journal";

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(19rem,0.75fr)_minmax(0,1.25fr)]">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-3 focus:ring-ring/40"
      >
        Skip to main content
      </a>

      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:min-h-screen lg:flex-col lg:p-10 xl:p-14">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />

        <Link
          href="/"
          className="flex w-fit items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/35"
        >
          <span className="flex size-11 items-center justify-center rounded-lg bg-white font-sans text-xs font-bold tracking-[0.12em] text-primary">
            {getJournalMark(journal)}
          </span>
          <span>
            <span className="block font-heading text-xl font-semibold">
              {journalShortName}
            </span>
            <span className="mt-0.5 block text-xs text-white/65">
              Author services
            </span>
          </span>
        </Link>

        <div className="my-auto max-w-lg py-12">
          <p className="text-xs font-semibold tracking-[0.14em] text-teal-200 uppercase">
            Scholarly publishing workspace
          </p>
          <h2 className="mt-4 text-4xl leading-tight font-semibold text-white xl:text-5xl">
            Submit research and follow every editorial step.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/72">
            Use your author account to submit manuscripts, respond to revision
            requests, and track decisions from one secure workspace.
          </p>

          <ul className="mt-9 grid gap-5" aria-label="Author account benefits">
            <li className="flex gap-3">
              <FilePenLine
                className="mt-0.5 size-5 shrink-0 text-teal-200"
                aria-hidden="true"
              />
              <span className="text-sm leading-6 text-white/82">
                Submit complete manuscript metadata and files.
              </span>
            </li>
            <li className="flex gap-3">
              <FileCheck2
                className="mt-0.5 size-5 shrink-0 text-teal-200"
                aria-hidden="true"
              />
              <span className="text-sm leading-6 text-white/82">
                See current status, decisions, and required actions.
              </span>
            </li>
            <li className="flex gap-3">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-teal-200"
                aria-hidden="true"
              />
              <span className="text-sm leading-6 text-white/82">
                Access only the submissions and feedback available to you.
              </span>
            </li>
          </ul>
        </div>

        <p className="text-xs leading-5 text-white/55" dir="auto">
          {journalName}
        </p>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="border-b border-border bg-surface-elevated px-4 py-3 sm:px-6 lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[0.65rem] font-bold tracking-[0.12em] text-primary-foreground">
                {getJournalMark(journal)}
              </span>
              <span className="truncate font-heading font-semibold text-foreground">
                {journalShortName}
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-text-secondary hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Journal
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          className="flex flex-1 items-center px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-16"
        >
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
