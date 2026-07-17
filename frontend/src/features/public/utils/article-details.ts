import type { PublicArticle } from "../types";

export function formatArticleDate(date: string) {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsedDate);
}

export function buildPlainTextCitation(article: PublicArticle) {
  const authors = article.authors.join(", ") || "Unknown author";
  const publishedDate = new Date(article.publishedAt);
  const year = Number.isNaN(publishedDate.getTime())
    ? "n.d."
    : publishedDate.getFullYear();
  const doiPart = article.doi ? ` https://doi.org/${article.doi}` : "";

  return `${authors} (${year}). ${article.title}. ${article.section}.${doiPart}`;
}
