import { BrowseSectionsSection } from "../components/browse-sections-section";
import { CurrentIssuePreviewSection } from "../components/current-issue-preview-section";
import { HeroSearchSection } from "../components/hero-search-section";
import { JournalInfoSection } from "../components/journal-info-section";
import { LatestArticlesSection } from "../components/latest-articles-section";
import { PublicFooter } from "../components/public-footer";
import { PublicHeader } from "../components/public-header";
import type {
  JournalInfo,
  PublicArticle,
  PublicIssue,
  PublicSection,
} from "../types";

type PublicLandingPageProps = {
  journal: JournalInfo;
  latestArticles: PublicArticle[];
  sections: PublicSection[];
  currentIssue: PublicIssue | null;
  currentIssueArticles: PublicArticle[];
};

export function PublicLandingPage({
  journal,
  latestArticles,
  sections,
  currentIssue,
  currentIssueArticles,
}: PublicLandingPageProps) {
  return (
    <>
      <PublicHeader journal={journal} />

      <main id="main-content">
        <HeroSearchSection journal={journal} />
        <LatestArticlesSection articles={latestArticles} />
        <BrowseSectionsSection sections={sections} />

        {currentIssue ? (
          <CurrentIssuePreviewSection
            issue={currentIssue}
            articles={currentIssueArticles}
          />
        ) : null}

        <JournalInfoSection journal={journal} />
      </main>

      <PublicFooter journal={journal} />
    </>
  );
}
