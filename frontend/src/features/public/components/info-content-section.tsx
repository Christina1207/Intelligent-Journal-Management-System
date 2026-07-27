import { FileText } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"

import type { InfoSection } from "../types"

type InfoContentSectionProps = {
  sections: InfoSection[]
  emptyTitle?: string
  emptyDescription?: string
}

function ContentBody({ body }: { body: string }) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <div className="mt-4 space-y-4 break-words text-base leading-8 text-text-secondary">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 30)}-${index}`} dir="auto">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

export function InfoContentSection({
  sections,
  emptyTitle = "Content not published",
  emptyDescription = "Journal-managed information is not currently available.",
}: InfoContentSectionProps) {
  if (sections.length === 0) {
    return (
      <section className="py-10 sm:py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={<FileText aria-hidden="true" />}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      </section>
    )
  }

  const showTableOfContents = sections.length > 2

  return (
    <section className="py-10 sm:py-12" aria-label="Page information">
      <div
        className={
          showTableOfContents
            ? "mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:px-8"
            : "mx-auto max-w-4xl px-4 sm:px-6 lg:px-8"
        }
      >
        {showTableOfContents ? (
          <aside>
            <nav
              aria-label="On this page"
              className="rounded-xl border border-border bg-card p-4 lg:sticky lg:top-24"
            >
              <h2 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                On this page
              </h2>
              <ol className="mt-3 space-y-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-md py-1 text-sm leading-5 text-text-secondary underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        ) : null}

        <div className="divide-y divide-border rounded-xl border border-border bg-card px-5 shadow-xs sm:px-8">
          {sections.map((section) => (
            <article
              key={section.id}
              id={section.id}
              tabIndex={-1}
              className="scroll-mt-24 py-7 first:pt-8 last:pb-8"
            >
              <h2
                className="text-2xl leading-snug font-semibold tracking-tight text-foreground"
                dir="auto"
              >
                {section.title}
              </h2>
              <ContentBody body={section.body} />

              {section.items && section.items.length > 0 ? (
                <ul className="mt-5 space-y-3">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-sm leading-6 text-text-secondary"
                      dir="auto"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
