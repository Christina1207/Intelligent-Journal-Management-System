import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { journalInfo } from "../data/public-home.mock";
import { openAccessSections } from "../data/public-info.mock";

export function PublicOpenAccessPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Open Access"
          title="Public access to published scientific articles."
          description="The journal website allows readers to browse, search, and access published research without requiring authentication."
          actions={[
            { label: "Browse Articles", href: "/articles" },
            {
              label: "Browse Archives",
              href: "/archives",
              variant: "secondary",
            },
          ]}
        />

        <InfoContentSection sections={openAccessSections} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
