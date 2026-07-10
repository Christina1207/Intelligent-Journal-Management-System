import Link from "next/link";
import type { JournalInfo } from "../types";

const navigationItems = [
  { label: "Articles", href: "/articles" },
  { label: "Sections", href: "/sections" },
  { label: "Archives", href: "/archives" },
  { label: "About", href: "/about" },
  { label: "Editorial Board", href: "/editorial-board" },
  { label: "Author Guidelines", href: "/author-guidelines" },
];

type PublicHeaderProps = {
  journal?: JournalInfo;
};

export function PublicHeader({ journal }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex flex-col">
          <span className="text-lg font-bold tracking-tight text-slate-950">
            {journal?.shortName ?? "Journal"}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {journal?.name ?? "Scientific Journal"}
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 md:flex"
        >
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-slate-950 sm:inline"
          >
            Login
          </Link>

          <Link
            href="/register?next=/author/submissions/new"
            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Submit Manuscript
          </Link>
        </div>
      </div>
    </header>
  );
}
