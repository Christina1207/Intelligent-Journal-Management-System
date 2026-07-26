import { PublicLandingPage } from "@/features/public/pages/public-landing-page";
import {
  getCurrentPublicIssue,
  getLatestPublicArticles,
  getPublicIssueArticles,
  getPublicJournal,
  getPublicSections,
} from "@/features/public/api/public-api";

export default async function HomePage() {
  const [journal, latestArticles, sections, currentIssue] = await Promise.all([
    getPublicJournal(),
    getLatestPublicArticles(3),
    getPublicSections(),
    getCurrentPublicIssue().catch(() => null),
  ]);

  const currentIssueArticles = currentIssue
    ? await getPublicIssueArticles(currentIssue.slug)
    : null;

  return (
    <PublicLandingPage
      journal={journal}
      latestArticles={latestArticles}
      sections={sections}
      currentIssue={currentIssue}
      currentIssueArticles={currentIssueArticles?.results ?? []}
    />
  );
}
