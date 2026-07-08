import { allPublicArticles, publicSections } from "../data/public-home.mock";
import type { PublicArticle, PublicSection } from "../types";

export function slugifySectionName(sectionName: string) {
  return sectionName.trim().toLowerCase().replaceAll(" ", "-");
}

export function findPublicSectionBySlug(slug: string) {
  return publicSections.find((section) => section.slug === slug);
}

export function getArticlesBySectionSlug(slug: string) {
  return allPublicArticles.filter(
    (article) => slugifySectionName(article.section) === slug,
  );
}

export function getSectionArticleCount(section: PublicSection) {
  return getArticlesBySectionSlug(section.slug).length;
}

export function getSectionKeywords(section: PublicSection) {
  const articles = getArticlesBySectionSlug(section.slug);

  const keywordCounts = new Map<string, number>();

  articles.forEach((article) => {
    article.keywords.forEach((keyword) => {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    });
  });

  return Array.from(keywordCounts.entries())
    .sort((first, second) => second[1] - first[1])
    .map(([keyword]) => keyword)
    .slice(0, 8);
}

export function getSectionLatestArticle(section: PublicSection) {
  const articles = getArticlesBySectionSlug(section.slug);

  return articles.sort(
    (first, second) =>
      new Date(second.publishedAt).getTime() -
      new Date(first.publishedAt).getTime(),
  )[0];
}

export function getRelatedSections(section: PublicSection, limit = 3) {
  return publicSections
    .filter((candidate) => candidate.id !== section.id)
    .map((candidate) => {
      const sharedTopicScore = candidate.topics.filter((topic) =>
        section.topics.includes(topic),
      ).length;

      return {
        section: candidate,
        score: sharedTopicScore,
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, limit)
    .map((candidate) => candidate.section);
}

export function sortArticlesNewestFirst(articles: PublicArticle[]) {
  return [...articles].sort(
    (first, second) =>
      new Date(second.publishedAt).getTime() -
      new Date(first.publishedAt).getTime(),
  );
}
