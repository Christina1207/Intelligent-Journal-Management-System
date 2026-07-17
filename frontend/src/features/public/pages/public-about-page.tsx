import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { fallbackAboutSections } from "../data/public-fallbacks";
import type { JournalInfo, PublicPageContent } from "../types";

type PublicAboutPageProps = {
  journal: JournalInfo;
  page: PublicPageContent | null;
};

export function PublicAboutPage({ journal, page }: PublicAboutPageProps) {
  const sections = page
    ? [
        {
          id: page.slug,
          title: page.title,
          body: page.content,
        },
      ]
    : fallbackAboutSections;

  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="About the Journal"
          title={page?.title ?? "About the Journal"}
          description={
            page?.excerpt ??
            "Learn about the journal mission, scope, and publishing model."
          }
          actions={[
            { label: "Browse Articles", href: "/articles" },
            {
              label: "Author Guidelines",
              href: "/author-guidelines",
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
