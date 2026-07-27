import { notFound } from "next/navigation";
import { PublicSectionDetailsPage } from "@/features/public/pages/public-section-details-page";
import {
  PUBLIC_ARTICLE_PAGE_SIZE,
  getPublicSection,
  getPublicSectionArticles,
  getPublicSections,
} from "@/features/public/api/public-api";

type SectionDetailsRouteParams = {
  slug: string;
};

type SectionDetailsPageProps = {
  params: Promise<SectionDetailsRouteParams>;
  searchParams: Promise<{ page?: string | string[] }>;
};

function readPage(value?: string | string[]) {
  const page = Array.isArray(value) ? value[0] : value;
  const parsedPage = Number(page);

  return Number.isInteger(parsedPage) && parsedPage > 0
    ? String(parsedPage)
    : undefined;
}

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
  searchParams,
}: SectionDetailsPageProps) {
  const resolvedParams = await params;
  const page = readPage((await searchParams).page);

  const [section, sections] = await Promise.all([
    getPublicSection(resolvedParams.slug),
    getPublicSections(),
  ]);

  if (!section) {
    notFound();
  }

  const articleResponse = await getPublicSectionArticles(section.slug, page);
  const relatedSections = sections
    .filter((candidate) => candidate.slug !== section.slug)
    .slice(0, 3);

  return (
    <PublicSectionDetailsPage
      section={section}
      articles={articleResponse.results}
      articleCount={articleResponse.count}
      currentPage={Number(page ?? "1")}
      totalPages={Math.max(
        Math.ceil(articleResponse.count / PUBLIC_ARTICLE_PAGE_SIZE),
        1,
      )}
      relatedSections={relatedSections}
    />
  );
}
