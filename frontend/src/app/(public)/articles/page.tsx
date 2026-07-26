import { PublicArticlesPage } from "@/features/public/pages/public-articles-page";
import {
  PUBLIC_ARTICLE_PAGE_SIZE,
  getPublicArticles,
  getPublicIssues,
  getPublicSections,
} from "@/features/public/api/public-api";
import type {
  ArticleSearchParams,
  ArticleSortOption,
} from "@/features/public/utils/article-search";

type ArticlesRouteSearchParams = {
  search?: string | string[];
  section?: string | string[];
  year?: string | string[];
  language?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};

type ArticlesPageProps = {
  searchParams: Promise<ArticlesRouteSearchParams>;
};

const validSortOptions: ArticleSortOption[] = [
  "newest",
  "oldest",
  "most_viewed",
  "most_downloaded",
  "title",
];

function readSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchParams(
  searchParams: ArticlesRouteSearchParams,
): ArticleSearchParams {
  const sort = readSingleParam(searchParams.sort);

  return {
    search: readSingleParam(searchParams.search),
    section: readSingleParam(searchParams.section),
    year: readSingleParam(searchParams.year),
    language: readSingleParam(searchParams.language),
    sort: validSortOptions.includes(sort as ArticleSortOption)
      ? (sort as ArticleSortOption)
      : "newest",
    page: normalizePage(readSingleParam(searchParams.page)),
  };
}

function normalizePage(page?: string) {
  const parsedPage = Number(page);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    return undefined;
  }

  return String(parsedPage);
}

function getYearOptions(
  issues: Awaited<ReturnType<typeof getPublicIssues>>,
) {
  return Array.from(
    new Set(issues.map((issue) => issue.year).filter(Boolean)),
  ).sort((first, second) => Number(second) - Number(first));
}

export default async function ArticlesPage({
  searchParams,
}: ArticlesPageProps) {
  const resolvedSearchParams = await searchParams;
  const normalizedParams = normalizeSearchParams(resolvedSearchParams);

  const [sections, issues, articleResponse] = await Promise.all([
    getPublicSections(),
    getPublicIssues(),
    getPublicArticles(normalizedParams),
  ]);

  const currentPage = Number(normalizedParams.page ?? "1");
  const totalPages = Math.max(
    Math.ceil(articleResponse.count / PUBLIC_ARTICLE_PAGE_SIZE),
    1,
  );

  return (
    <PublicArticlesPage
      articles={articleResponse.results}
      totalResults={articleResponse.count}
      currentPage={currentPage}
      totalPages={totalPages}
      sections={sections}
      years={getYearOptions(issues)}
      searchParams={normalizedParams}
    />
  );
}
