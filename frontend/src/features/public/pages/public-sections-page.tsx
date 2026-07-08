import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { PublicSectionCard } from "../components/public-section-card";
import { SectionsOverviewHeader } from "../components/sections-overview-header";
import {
  allPublicArticles,
  journalInfo,
  publicSections,
} from "../data/public-home.mock";

export function PublicSectionsPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <SectionsOverviewHeader
          sectionCount={publicSections.length}
          articleCount={allPublicArticles.length}
        />

        <section
          className="py-12 sm:py-16"
          aria-labelledby="sections-list-title"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="sections-list-title" className="sr-only">
              Available journal sections
            </h2>

            <div className="grid gap-6 lg:grid-cols-2">
              {publicSections.map((section) => (
                <PublicSectionCard key={section.id} section={section} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
