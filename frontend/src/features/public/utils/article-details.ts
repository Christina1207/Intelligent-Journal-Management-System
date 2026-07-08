import { allPublicArticles } from "../data/public-home.mock";
import type { PublicArticle } from "../types";

export function findPublicArticleBySlug(slug: string) {
  return allPublicArticles.find((article) => article.slug === slug);
}

export function getRelatedArticles(article: PublicArticle, limit = 3) {
  return allPublicArticles
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      const sameSectionScore = candidate.section === article.section ? 3 : 0;

      const sharedKeywordScore = candidate.keywords.filter((keyword) =>
        article.keywords.includes(keyword),
      ).length;

      return {
        article: candidate,
        score: sameSectionScore + sharedKeywordScore,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((candidate) => candidate.article);
}

export function formatArticleDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function buildPlainTextCitation(article: PublicArticle) {
  const authors = article.authors.join(", ");
  const year = new Date(article.publishedAt).getFullYear();
  const doiPart = article.doi ? ` https://doi.org/${article.doi}` : "";

  return `${authors} (${year}). ${article.title}. ${article.section}.${doiPart}`;
}
