import { notFound } from "next/navigation";
import { PublicSectionDetailsPage } from "@/features/public/pages/public-section-details-page";
import {
  getPublicJournal,
  getPublicSection,
  getPublicSectionArticles,
  getPublicSections,
} from "@/features/public/api/public-api";

type SectionDetailsRouteParams = {
  slug: string;
};

type SectionDetailsPageProps = {
  params: Promise<SectionDetailsRouteParams>;
};

export async function generateMetadata({ params }: SectionDetailsPageProps) {
  const resolvedParams = await params;
  const section = await getPublicSection(resolvedParams.slug);

  if (!section) {
    return {
      title: "Section Not Found",
    };
  }

  return {
    title: `${section.name} | Journal Sections`,
    description: section.description,
  };
}

export default async function SectionDetailsPage({
  params,
}: SectionDetailsPageProps) {
  const resolvedParams = await params;

  const [journal, section, sections] = await Promise.all([
    getPublicJournal(),
    getPublicSection(resolvedParams.slug),
    getPublicSections(),
  ]);

  if (!section) {
    notFound();
  }

  const articles = await getPublicSectionArticles(section.slug);
  const relatedSections = sections
    .filter((candidate) => candidate.slug !== section.slug)
    .slice(0, 3);

  return (
    <PublicSectionDetailsPage
      journal={journal}
      section={section}
      articles={articles}
      relatedSections={relatedSections}
    />
  );
}
