import { BrowseSectionsSection } from "../components/browse-sections-section";
import { HeroSearchSection } from "../components/hero-search-section";
import { JournalInfoSection } from "../components/journal-info-section";
import { LatestArticlesSection } from "../components/latest-articles-section";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import {
  journalInfo,
  latestArticles,
  publicSections,
} from "../data/public-home.mock";

export function PublicLandingPage() {
  return (
    <>
      <PublicHeader />

      <main id="main-content">
        <HeroSearchSection journal={journalInfo} />
        <LatestArticlesSection articles={latestArticles} />
        <BrowseSectionsSection sections={publicSections} />
        <JournalInfoSection journal={journalInfo} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
