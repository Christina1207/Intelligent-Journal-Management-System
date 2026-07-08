import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import { authorGuidelineSections } from "../data/public-info.mock";

export function PublicAuthorGuidelinesPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Author Guidelines"
          title="Prepare and submit manuscripts correctly."
          description="Authors should follow the journal requirements before submitting manuscripts for editorial screening and peer review."
          actions={[
            { label: "Submit Manuscript", href: "/register" },
            {
              label: "Publication Ethics",
              href: "/publication-ethics",
              variant: "secondary",
            },
          ]}
        />

        <InfoContentSection sections={authorGuidelineSections} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
