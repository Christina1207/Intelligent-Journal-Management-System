import Link from "next/link"

import type { JournalInfo } from "../types"
import { publicFooterNavigation } from "./public-navigation"

type PublicFooterProps = {
  journal: JournalInfo | null
}

export function PublicFooter({ journal }: PublicFooterProps) {
  const journalName =
    journal?.name.trim() || journal?.shortName.trim() || "Journal portal"
  const footerFacts = [
    journal?.issn ? `ISSN ${journal.issn}` : null,
    journal?.accessPolicy || null,
    journal?.license || null,
  ].filter(Boolean)

  return (
    <footer className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_2fr] lg:px-8">
        <div>
          <h2 className="text-xl font-semibold">{journalName}</h2>
          {journal?.description ? (
            <p className="mt-3 max-w-md text-sm leading-6 text-sidebar-foreground/75">
              {journal.description}
            </p>
          ) : null}
          {footerFacts.length > 0 ? (
            <p className="mt-5 text-xs leading-5 text-sidebar-foreground/65">
              {footerFacts.join(" · ")}
            </p>
          ) : null}
        </div>

        <nav
          aria-label="Footer navigation"
          className="grid gap-8 sm:grid-cols-3"
        >
          {publicFooterNavigation.map((group) => (
            <div key={group.title}>
              <h3 className="font-sans text-sm font-semibold">{group.title}</h3>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-sidebar-foreground/70 underline-offset-4 transition-colors hover:text-sidebar-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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

      <div className="border-t border-sidebar-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-sidebar-foreground/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {journal?.publisher || journalName}
          </p>
          <p>Scholarly publishing and journal management</p>
        </div>
      </div>
    </footer>
  )
}
