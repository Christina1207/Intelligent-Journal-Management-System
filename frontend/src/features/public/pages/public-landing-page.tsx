import { BrowseSectionsSection } from "../components/browse-sections-section"
import { CurrentIssuePreviewSection } from "../components/current-issue-preview-section"
import { HeroSearchSection } from "../components/hero-search-section"
import { JournalInfoSection } from "../components/journal-info-section"
import { LatestArticlesSection } from "../components/latest-articles-section"
import type {
  JournalInfo,
  PublicArticle,
  PublicIssue,
  PublicSection,
} from "../types"

type PublicLandingPageProps = {
  journal: JournalInfo
  latestArticles: PublicArticle[]
  sections: PublicSection[]
  currentIssue: PublicIssue | null
  currentIssueArticles: PublicArticle[]
}

export function PublicLandingPage({
  journal,
  latestArticles,
  sections,
  currentIssue,
  currentIssueArticles,
}: PublicLandingPageProps) {
  return (
    <>
      <HeroSearchSection journal={journal} />
      <LatestArticlesSection articles={latestArticles} />
      <CurrentIssuePreviewSection
        issue={currentIssue}
        articles={currentIssueArticles}
      />
      <BrowseSectionsSection sections={sections} />
      <JournalInfoSection journal={journal} />
    </>
  )
}
