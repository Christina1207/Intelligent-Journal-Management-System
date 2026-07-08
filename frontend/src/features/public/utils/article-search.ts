import type { PublicArticle } from "../types";

export type ArticleSortOption =
  | "newest"
  | "oldest"
  | "most_viewed"
  | "most_downloaded"
  | "title";

export type ArticleSearchParams = {
  search?: string;
  section?: string;
  year?: string;
  language?: string;
  sort?: ArticleSortOption;
  page?: string;
};

export type ArticleSearchResult = {
  articles: PublicArticle[];
  totalResults: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 6;

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function articleMatchesSearch(article: PublicArticle, search?: string) {
  if (!search) {
    return true;
  }

  const query = normalizeValue(search);

  const searchableText = [
    article.title,
    article.abstract,
    article.section,
    article.doi ?? "",
    article.language,
    ...article.authors,
    ...article.keywords,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function articleMatchesSection(article: PublicArticle, section?: string) {
  if (!section || section === "all") {
    return true;
  }

  return normalizeValue(article.section).replaceAll(" ", "-") === section;
}

function articleMatchesYear(article: PublicArticle, year?: string) {
  if (!year || year === "all") {
    return true;
  }

  return new Date(article.publishedAt).getFullYear().toString() === year;
}

function articleMatchesLanguage(article: PublicArticle, language?: string) {
  if (!language || language === "all") {
    return true;
  }

  return normalizeValue(article.language) === normalizeValue(language);
}

function sortArticles(
  articles: PublicArticle[],
  sort: ArticleSortOption = "newest",
) {
  return [...articles].sort((first, second) => {
    switch (sort) {
      case "oldest":
        return (
          new Date(first.publishedAt).getTime() -
          new Date(second.publishedAt).getTime()
        );

      case "most_viewed":
        return second.views - first.views;

      case "most_downloaded":
        return second.downloads - first.downloads;

      case "title":
        return first.title.localeCompare(second.title);

      case "newest":
      default:
        return (
          new Date(second.publishedAt).getTime() -
          new Date(first.publishedAt).getTime()
        );
    }
  });
}

function parsePage(page?: string) {
  const parsedPage = Number(page);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return parsedPage;
}

export function getArticleYears(articles: PublicArticle[]) {
  return Array.from(
    new Set(
      articles.map((article) =>
        new Date(article.publishedAt).getFullYear().toString(),
      ),
    ),
  ).sort((first, second) => Number(second) - Number(first));
}

export function searchPublicArticles(
  articles: PublicArticle[],
  params: ArticleSearchParams,
): ArticleSearchResult {
  const filteredArticles = articles.filter((article) => {
    return (
      articleMatchesSearch(article, params.search) &&
      articleMatchesSection(article, params.section) &&
      articleMatchesYear(article, params.year) &&
      articleMatchesLanguage(article, params.language)
    );
  });

  const sortedArticles = sortArticles(filteredArticles, params.sort);

  const pageSize = DEFAULT_PAGE_SIZE;
  const totalResults = sortedArticles.length;
  const totalPages = Math.max(Math.ceil(totalResults / pageSize), 1);
  const requestedPage = parsePage(params.page);
  const currentPage = Math.min(requestedPage, totalPages);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedArticles = sortedArticles.slice(
    startIndex,
    startIndex + pageSize,
  );

  return {
    articles: paginatedArticles,
    totalResults,
    totalPages,
    currentPage,
    pageSize,
  };
}
