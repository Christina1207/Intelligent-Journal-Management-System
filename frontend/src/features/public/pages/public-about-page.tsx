import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { aboutSections } from "../data/public-info.mock";
import { journalInfo } from "../data/public-home.mock";

export function PublicAboutPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="About the Journal"
          title="A peer-reviewed open-access journal for scientific research."
          description="Learn about the journal mission, scope, publishing model, and the public research portal provided by the system."
          actions={[
            { label: "Browse Articles", href: "/articles" },
            {
              label: "Author Guidelines",
              href: "/author-guidelines",
              variant: "secondary",
            },
          ]}
        />

        <InfoContentSection sections={aboutSections} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
