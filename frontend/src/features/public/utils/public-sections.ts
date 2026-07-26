import type { PublicArticle } from "../types";

export function getSectionKeywords(articles: PublicArticle[]) {
  const keywordCounts = new Map<string, number>();

  articles.forEach((article) => {
    article.keywords.forEach((keyword) => {
      const normalizedKeyword = keyword.trim();

      if (!normalizedKeyword) {
        return;
      }

      keywordCounts.set(
        normalizedKeyword,
        (keywordCounts.get(normalizedKeyword) ?? 0) + 1,
      );
    });
  });

  return Array.from(keywordCounts.entries())
    .sort((first, second) => {
      const countDifference = second[1] - first[1];

      if (countDifference !== 0) {
        return countDifference;
      }

      return first[0].localeCompare(second[0]);
    })
    .map(([keyword]) => keyword)
    .slice(0, 8);
}
