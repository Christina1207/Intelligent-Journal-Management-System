import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { fallbackPublicationEthicsSections } from "../data/public-fallbacks";
import type { JournalInfo, PublicPageContent } from "../types";

type PageProps = {
  journal: JournalInfo;
  page: PublicPageContent | null;
};

export function PublicPublicationEthicsPage({ journal, page }: PageProps) {
  const sections = page
    ? [
        {
          id: page.slug,
          title: page.title,
          body: page.content,
        },
      ]
    : fallbackPublicationEthicsSections;

  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Publication Ethics"
          title={
            page?.title ??
            "Editorial integrity, originality, and responsible peer review."
          }
          description={
            page?.excerpt ??
            "The journal expects authors, reviewers, editors, and section managers to follow ethical publishing practices throughout submission, review, decision, and publication."
          }
          actions={[
            { label: "Author Guidelines", href: "/author-guidelines" },
            {
              label: "Contact the Journal",
              href: "/contact",
              variant: "secondary",
            },
          ]}
        />

        <InfoContentSection sections={sections} />
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
