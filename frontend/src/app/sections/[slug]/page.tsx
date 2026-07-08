import { notFound } from "next/navigation";
import { PublicSectionDetailsPage } from "@/features/public/pages/public-section-details-page";
import { publicSections } from "@/features/public/data/public-home.mock";
import {
  findPublicSectionBySlug,
  getArticlesBySectionSlug,
  sortArticlesNewestFirst,
} from "@/features/public/utils/public-sections";

type SectionDetailsRouteParams = {
  slug: string;
};

type SectionDetailsPageProps = {
  params: Promise<SectionDetailsRouteParams>;
};

export function generateStaticParams() {
  return publicSections.map((section) => ({
    slug: section.slug,
  }));
}

export async function generateMetadata({ params }: SectionDetailsPageProps) {
  const resolvedParams = await params;
  const section = findPublicSectionBySlug(resolvedParams.slug);

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
  const section = findPublicSectionBySlug(resolvedParams.slug);

  if (!section) {
    notFound();
  }

  const articles = sortArticlesNewestFirst(
    getArticlesBySectionSlug(section.slug),
  );

  return <PublicSectionDetailsPage section={section} articles={articles} />;
}
