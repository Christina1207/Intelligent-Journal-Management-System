import {
  ArrowRight,
  BookMarked,
  Building2,
  CalendarRange,
  Scale,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

import type { JournalInfo } from "../types"
import { submissionLoginHref } from "./public-navigation"

type JournalInfoSectionProps = {
  journal: JournalInfo
}

export function JournalInfoSection({ journal }: JournalInfoSectionProps) {
  const facts = [
    journal.publisher
      ? { label: "Publisher", value: journal.publisher, icon: Building2 }
      : null,
    journal.issn
      ? { label: "ISSN", value: journal.issn, icon: BookMarked }
      : null,
    journal.peerReviewPolicy
      ? {
          label: "Peer review",
          value: journal.peerReviewPolicy,
          icon: ShieldCheck,
        }
      : null,
    journal.publicationFrequency
      ? {
          label: "Publication schedule",
          value: journal.publicationFrequency,
          icon: CalendarRange,
        }
      : null,
    journal.accessPolicy
      ? { label: "Access", value: journal.accessPolicy, icon: Scale }
      : null,
  ].filter(Boolean)

  return (
    <section
      className="border-t border-border bg-surface-elevated py-12 sm:py-16"
      aria-labelledby="journal-information-title"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
            Journal information
          </p>
          <h2
            id="journal-information-title"
            className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-foreground"
          >
            About {journal.shortName || journal.name}
          </h2>
          {journal.description ? (
            <p className="mt-4 max-w-xl text-sm leading-7 text-text-secondary" dir="auto">
              {journal.description}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/about"
              className={buttonVariants({ variant: "default", size: "touch" })}
            >
              About the journal
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Link>
            <Link
              href="/author-guidelines"
              className={buttonVariants({ variant: "outline", size: "touch" })}
            >
              Author guidelines
            </Link>
            <Link
              href={submissionLoginHref}
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              Submit manuscript
            </Link>
          </div>
        </div>

        {facts.length > 0 ? (
          <dl className="grid gap-x-8 gap-y-5 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2">
            {facts.map((fact) => {
              if (!fact) {
                return null
              }

              const Icon = fact.icon
              return (
                <div key={fact.label} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-5 text-foreground" dir="auto">
                      {fact.value}
                    </dd>
                  </div>
                </div>
              )
            })}
          </dl>
        ) : null}
      </div>
    </section>
  )
}
