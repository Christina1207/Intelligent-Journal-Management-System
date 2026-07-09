import { PublicArchivesPage } from "@/features/public/pages/public-archives-page";
import {
  getPublicArticles,
  getPublicIssues,
  getPublicJournal,
} from "@/features/public/api/public-api";

export const metadata = {
  title: "Archives",
  description: "Browse published journal issues and archives.",
};

export default async function ArchivesPage() {
  const [journal, issues, articles] = await Promise.all([
    getPublicJournal(),
    getPublicIssues(),
    getPublicArticles(),
  ]);

  return (
    <PublicArchivesPage
      journal={journal}
      issues={issues}
      articleCount={articles.count}
    />
  );
}
