import { notFound } from "next/navigation";
import { PublicArticleDetailsPage } from "@/features/public/pages/public-article-details-page";
import {
  getPublicArticle,
  getPublicArticles,
  getPublicJournal,
} from "@/features/public/api/public-api";

type ArticleDetailsRouteParams = {
  slug: string;
};

type ArticleDetailsPageProps = {
  params: Promise<ArticleDetailsRouteParams>;
};

export async function generateMetadata({ params }: ArticleDetailsPageProps) {
  const resolvedParams = await params;
  const article = await getPublicArticle(resolvedParams.slug);

  if (!article) {
    return {
      title: "Article Not Found",
    };
  }

  return {
    title: article.title,
    description: article.abstract,
  };
}

export default async function ArticleDetailsPage({
  params,
}: ArticleDetailsPageProps) {
  const resolvedParams = await params;

  const [journal, article] = await Promise.all([
    getPublicJournal(),
    getPublicArticle(resolvedParams.slug),
  ]);

  if (!article) {
    notFound();
  }

  const relatedResponse = await getPublicArticles({
    section: article.sectionSlug,
    ordering: "-published_at",
  });

  const relatedArticles = relatedResponse.results
    .filter((candidate) => candidate.slug !== article.slug)
    .slice(0, 3);

  return (
    <PublicArticleDetailsPage
      journal={journal}
      article={article}
      relatedArticles={relatedArticles}
    />
  );
}
