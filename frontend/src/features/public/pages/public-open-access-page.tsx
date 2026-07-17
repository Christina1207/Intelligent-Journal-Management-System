import { InfoContentSection } from "../components/info-content-section";
import { InfoPageHero } from "../components/info-page-hero";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import { fallbackOpenAccessSections } from "../data/public-fallbacks";
import type { JournalInfo, PublicPageContent } from "../types";

type PageProps = {
  journal: JournalInfo;
  page: PublicPageContent | null;
};

export function PublicOpenAccessPage({ journal, page }: PageProps) {
  const sections = page
    ? [
        {
          id: page.slug,
          title: page.title,
          body: page.content,
        },
      ]
    : fallbackOpenAccessSections;

  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content" className="bg-slate-50">
        <InfoPageHero
          eyebrow="Open Access"
          title={page?.title ?? "Public access to published scientific articles."}
          description={
            page?.excerpt ??
            "The journal website allows readers to browse, search, and access published research without requiring authentication."
          }
          actions={[
            { label: "Browse Articles", href: "/articles" },
            {
              label: "Browse Archives",
              href: "/archives",
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
