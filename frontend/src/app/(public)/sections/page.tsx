import { PublicSectionsPage } from "@/features/public/pages/public-sections-page";
import {
  getPublicArticles,
  getPublicSections,
} from "@/features/public/api/public-api";

export default async function SectionsPage() {
  const [sections, articles] = await Promise.all([
    getPublicSections(),
    getPublicArticles(),
  ]);

  return (
    <PublicSectionsPage
      sections={sections}
      articleCount={articles.count}
    />
  );
}
