import { ArrowUpRight } from "lucide-react"

import type { ContactMethod } from "../types"

type ContactCardProps = {
  contact: ContactMethod
}

function ContactContent({ contact }: ContactCardProps) {
  return (
    <>
      <h2 className="font-sans text-base font-semibold text-foreground">
        {contact.title}
      </h2>
      <p
        className="mt-2 break-words text-sm font-medium text-accent"
        dir="auto"
      >
        {contact.value}
      </p>
      {contact.description ? (
        <p className="mt-3 text-sm leading-6 text-text-secondary" dir="auto">
          {contact.description}
        </p>
      ) : null}
    </>
  )
}

export function ContactCard({ contact }: ContactCardProps) {
  if (contact.href) {
    return (
      <a
        href={contact.href}
        className="group relative block rounded-xl border border-border bg-card p-5 pr-12 shadow-xs hover:border-accent"
      >
        <ContactContent contact={contact} />
        <ArrowUpRight
          className="absolute top-5 right-5 size-4 text-muted-foreground group-hover:text-accent"
          aria-hidden="true"
        />
      </a>
    )
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <ContactContent contact={contact} />
    </article>
  )
}
