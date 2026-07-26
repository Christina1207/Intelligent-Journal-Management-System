import { PublicSectionsPage } from "@/features/public/pages/public-sections-page";
import {
  getPublicArticles,
  getPublicJournal,
  getPublicSections,
} from "@/features/public/api/public-api";

export default async function SectionsPage() {
  const [journal, sections, articles] = await Promise.all([
    getPublicJournal(),
    getPublicSections(),
    getPublicArticles(),
  ]);

  return (
    <PublicSectionsPage
      journal={journal}
      sections={sections}
      articleCount={articles.count}
    />
  );
}
