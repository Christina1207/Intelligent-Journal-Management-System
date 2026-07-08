import { notFound } from "next/navigation";
import { PublicArticleDetailsPage } from "@/features/public/pages/public-article-details-page";
import {
  findPublicArticleBySlug,
  getRelatedArticles,
} from "@/features/public/utils/article-details";
import { allPublicArticles } from "@/features/public/data/public-home.mock";

type ArticleDetailsRouteParams = {
  slug: string;
};

type ArticleDetailsPageProps = {
  params: Promise<ArticleDetailsRouteParams>;
};

export function generateStaticParams() {
  return allPublicArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: ArticleDetailsPageProps) {
  const resolvedParams = await params;
  const article = findPublicArticleBySlug(resolvedParams.slug);

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
  const article = findPublicArticleBySlug(resolvedParams.slug);

  if (!article) {
    notFound();
  }

  const relatedArticles = getRelatedArticles(article);

  return (
    <PublicArticleDetailsPage
      article={article}
      relatedArticles={relatedArticles}
    />
  );
}
