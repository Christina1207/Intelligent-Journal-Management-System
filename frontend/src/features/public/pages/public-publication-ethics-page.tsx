import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import { publicationEthicsSections } from "../data/public-info.mock";

export function PublicPublicationEthicsPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Publication Ethics"
          title="Editorial integrity, originality, and responsible peer review."
          description="The journal expects authors, reviewers, editors, and section managers to follow ethical publishing practices throughout submission, review, decision, and publication."
          actions={[
            { label: "Author Guidelines", href: "/author-guidelines" },
            {
              label: "Contact the Journal",
              href: "/contact",
              variant: "secondary",
            },
          ]}
        />

        <InfoContentSection sections={publicationEthicsSections} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
