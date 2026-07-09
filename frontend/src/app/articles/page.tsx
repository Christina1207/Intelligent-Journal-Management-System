import { PublicArticlesPage } from "@/features/public/pages/public-articles-page";
import {
  getPublicArticles,
  getPublicJournal,
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
    page: readSingleParam(searchParams.page),
  };
}

function getYearOptionsFromCurrentYear() {
  const currentYear = new Date().getFullYear();

  return Array.from({ length: 10 }, (_, index) => String(currentYear - index));
}

export default async function ArticlesPage({
  searchParams,
}: ArticlesPageProps) {
  const resolvedSearchParams = await searchParams;
  const normalizedParams = normalizeSearchParams(resolvedSearchParams);

  const [journal, sections, articleResponse] = await Promise.all([
    getPublicJournal(),
    getPublicSections(),
    getPublicArticles(normalizedParams),
  ]);

  const pageSize = articleResponse.results.length || 1;
  const currentPage = Number(normalizedParams.page ?? "1");
  const totalPages = Math.max(Math.ceil(articleResponse.count / pageSize), 1);

  return (
    <PublicArticlesPage
      journal={journal}
      articles={articleResponse.results}
      totalResults={articleResponse.count}
      currentPage={currentPage}
      totalPages={totalPages}
      sections={sections}
      years={getYearOptionsFromCurrentYear()}
      searchParams={normalizedParams}
    />
  );
}
