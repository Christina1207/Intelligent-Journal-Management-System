import { BrowseSectionsSection } from "../components/browse-sections-section";
import { CurrentIssuePreviewSection } from "../components/current-issue-preview-section";
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
import {
  getArticlesByIssueSlug,
  getCurrentIssue,
} from "../utils/public-issues";

export function PublicLandingPage() {
  const currentIssue = getCurrentIssue();
  const currentIssueArticles = getArticlesByIssueSlug(currentIssue.slug);
  return (
    <>
      <PublicHeader />

      <main id="main-content">
        <HeroSearchSection journal={journalInfo} />
        <LatestArticlesSection articles={latestArticles} />
        <BrowseSectionsSection sections={publicSections} />
        <CurrentIssuePreviewSection
          issue={currentIssue}
          articles={currentIssueArticles}
        />
        <JournalInfoSection journal={journalInfo} />
      </main>

      <PublicFooter journal={journalInfo} />
    </>
  );
}
