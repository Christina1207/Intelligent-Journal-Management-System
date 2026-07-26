import {
  BookOpen,
  Building2,
  CalendarRange,
  Search,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

import type { JournalInfo } from "../types"
import { submissionLoginHref } from "./public-navigation"

type HeroSearchSectionProps = {
  journal: JournalInfo
}

export function HeroSearchSection({ journal }: HeroSearchSectionProps) {
  const facts = [
    journal.issn
      ? { label: "ISSN", value: journal.issn, icon: BookOpen }
      : null,
    journal.publisher
      ? { label: "Publisher", value: journal.publisher, icon: Building2 }
      : null,
    journal.publicationFrequency
      ? {
          label: "Publication",
          value: journal.publicationFrequency,
          icon: CalendarRange,
        }
      : null,
    journal.license
      ? { label: "License", value: journal.license, icon: ShieldCheck }
      : null,
  ].filter(Boolean)

  return (
    <section className="border-b border-primary/20 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-wide text-primary-foreground/75 uppercase">
            {journal.peerReviewPolicy ? (
              <span>{journal.peerReviewPolicy}</span>
            ) : null}
            {journal.peerReviewPolicy && journal.accessPolicy ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {journal.accessPolicy ? <span>{journal.accessPolicy}</span> : null}
          </div>

          <h1
            className="mt-3 max-w-4xl text-4xl leading-tight font-semibold tracking-tight text-primary-foreground sm:text-5xl"
            dir="auto"
          >
            {journal.name}
          </h1>

          {journal.description ? (
            <p
              className="mt-4 max-w-3xl text-base leading-7 text-primary-foreground/78 sm:text-lg"
              dir="auto"
            >
              {journal.description}
            </p>
          ) : null}

          <form
            action="/articles"
            method="GET"
            role="search"
            className="mt-7 max-w-3xl"
          >
            <label
              htmlFor="public-article-search"
              className="text-sm font-semibold text-primary-foreground"
            >
              Search published research
            </label>
            <div className="mt-2 flex flex-col gap-2 rounded-xl bg-white p-2 shadow-lg sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  id="public-article-search"
                  name="search"
                  type="search"
                  placeholder="Title, author, abstract, keyword, or DOI"
                  className="min-h-12 w-full rounded-lg border border-transparent bg-white pr-4 pl-10 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/25"
                />
              </div>
              <button
                type="submit"
                className={buttonVariants({
                  variant: "accent",
                  size: "touch",
                })}
              >
                <Search data-icon="inline-start" aria-hidden="true" />
                Search articles
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={submissionLoginHref}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-primary shadow-xs hover:bg-white/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              Submit a manuscript
            </Link>
            <Link
              href="/author-guidelines"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              Author guidelines
            </Link>
          </div>
        </div>

        {facts.length > 0 ? (
          <aside
            className="rounded-xl border border-white/15 bg-white/7 p-5"
            aria-label="Journal facts"
          >
            <h2 className="font-sans text-sm font-semibold text-white">
              Journal facts
            </h2>
            <dl className="mt-4 divide-y divide-white/12">
              {facts.map((fact) => {
                if (!fact) {
                  return null
                }

                const Icon = fact.icon
                return (
                  <div key={fact.label} className="flex gap-3 py-3 first:pt-0">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-teal-200"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <dt className="text-xs text-white/60">{fact.label}</dt>
                      <dd className="mt-0.5 text-sm leading-5 text-white" dir="auto">
                        {fact.value}
                      </dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          </aside>
        ) : null}
      </div>
    </section>
  )
}
