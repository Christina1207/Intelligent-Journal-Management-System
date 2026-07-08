import { ContactCard } from "../components/contact-card";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import { contactMethods } from "../data/public-info.mock";

export function PublicContactPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Contact"
          title="Contact the journal office."
          description="Use the contact information below for editorial, technical, and publishing-related questions."
          actions={[
            { label: "Browse Articles", href: "/articles" },
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

            <div className="grid gap-6 md:grid-cols-3">
              {contactMethods.map((contact) => (
                <ContactCard key={contact.id} contact={contact} />
              ))}
            </div>

            <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">
                Response and Support Notes
              </h2>

              <p className="mt-4 leading-8 text-slate-700">
                For production deployment, replace these placeholder contact
                values with official university or journal contact channels.
                This page is currently prepared as a public journal information
                page for the prototype.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
