import { ContactCard } from "../components/contact-card";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type { ContactMethod, JournalInfo } from "../types";

type PublicContactPageProps = {
  journal: JournalInfo;
  contacts: ContactMethod[];
};

export function PublicContactPage({
  journal,
  contacts,
}: PublicContactPageProps) {
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Contact"
          title="Contact the journal office."
          description="Use the official contact channels below for editorial, technical, and publishing-related questions."
          actions={[
            {
              label: "Browse Articles",
              href: "/articles",
            },
            {
              label: "Author Guidelines",
              href: "/author-guidelines",
              variant: "secondary",
            },
          ]}
        />

        <section className="py-12 sm:py-16" aria-labelledby="contact-title">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="contact-title" className="sr-only">
              Contact methods
            </h2>

            {contacts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-3">
                {contacts.map((contact) => (
                  <ContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
                <h2 className="text-xl font-bold text-slate-950">
                  Contact information unavailable
                </h2>

                <p className="mt-3 text-slate-600">
                  Official journal contact channels have not been configured
                  yet.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
