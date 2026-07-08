import { PublicArticlesPage } from "@/features/public/pages/public-articles-page";
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
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
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

export default async function ArticlesPage({
  searchParams,
}: ArticlesPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <PublicArticlesPage
      searchParams={normalizeSearchParams(resolvedSearchParams)}
    />
  );
}
