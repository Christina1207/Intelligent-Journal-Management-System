import Link from "next/link";
import type { JournalInfo } from "../types";

type PublicFooterProps = {
  journal: JournalInfo;
};

const footerGroups = [
  {
    title: "Journal",
    links: [
      { label: "About", href: "/about" },
      { label: "Editorial Board", href: "/editorial-board" },
      { label: "Sections", href: "/sections" },
      { label: "Archives", href: "/archives" },
    ],
  },
  {
    title: "Authors",
    links: [
      { label: "Author Guidelines", href: "/author-guidelines" },
      { label: "Submission Preparation", href: "/submission-guidelines" },
      { label: "Publication Ethics", href: "/publication-ethics" },
      { label: "Submit Manuscript", href: "/register" },
    ],
  },
  {
    title: "Readers",
    links: [
      { label: "Latest Articles", href: "/articles" },
      { label: "Search", href: "/articles" },
      { label: "Open Access Policy", href: "/open-access" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function PublicFooter({ journal }: PublicFooterProps) {
  return (
    <footer className="border-t bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_2fr] lg:px-8">
        <div>
          <h2 className="text-lg font-bold">{journal.shortName}</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
            {journal.description}
          </p>

          <p className="mt-5 text-sm text-slate-400">
            ISSN: {journal.issn} · {journal.license}
          </p>
        </div>

        <nav
          aria-label="Footer navigation"
          className="grid gap-8 sm:grid-cols-3"
        >
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold">{group.title}</h3>

              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-300 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {journal.publisher}. All rights
            reserved.
          </p>

          <p>{journal.accessPolicy} scientific publishing portal.</p>
        </div>
      </div>
    </footer>
  );
}
