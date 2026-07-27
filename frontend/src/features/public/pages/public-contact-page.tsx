import { ContactRound } from "lucide-react"

import { EmptyState } from "@/components/common/empty-state"

import { ContactCard } from "../components/contact-card"
import { InfoPageHero } from "../components/info-page-hero"
import type { ContactMethod } from "../types"

type PublicContactPageProps = {
  contacts: ContactMethod[]
}

export function PublicContactPage({
  contacts,
}: PublicContactPageProps) {
  return (
    <>
      <InfoPageHero
        eyebrow="Contact"
        title="Contact the Journal"
        actions={[
          { label: "Browse Articles", href: "/articles" },
          {
            label: "Author Guidelines",
            href: "/author-guidelines",
            variant: "secondary",
          },
        ]}
      />

      <section className="py-10 sm:py-12" aria-labelledby="contact-title">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 id="contact-title" className="sr-only">
            Journal contact methods
          </h2>
          {contacts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {contacts.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<ContactRound aria-hidden="true" />}
              title="Contact information unavailable"
              description="Official contact methods have not been published through the journal API."
            />
          )}
        </div>
      </section>
    </>
  )
}
