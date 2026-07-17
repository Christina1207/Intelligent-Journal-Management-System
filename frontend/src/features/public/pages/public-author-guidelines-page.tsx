import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { fallbackAuthorGuidelineSections } from "../data/public-fallbacks";
import type { JournalInfo, PublicPageContent } from "../types";

type PageProps = {
  journal: JournalInfo;
  page: PublicPageContent | null;
};

export function PublicAuthorGuidelinesPage({ journal, page }: PageProps) {
  const sections = page
    ? [
        {
          id: page.slug,
          title: page.title,
          body: page.content,
        },
      ]
    : fallbackAuthorGuidelineSections;

  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Author Guidelines"
          title={page?.title ?? "Prepare and submit manuscripts correctly."}
          description={
            page?.excerpt ??
            "Authors should follow the journal requirements before submitting manuscripts for editorial screening and peer review."
          }
          actions={[
            { label: "Submit Manuscript", href: "/register" },
            {
              label: "Publication Ethics",
              href: "/publication-ethics",
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
