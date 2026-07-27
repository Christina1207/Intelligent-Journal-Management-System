import {
  mapArticle,
  mapContactMethod,
  mapEditorialBoardMember,
  mapIssue,
  mapJournal,
  mapPublicPage,
  mapSection,
} from "./public-api.mappers";
import type {
  ContactMethodApiDto,
  EditorialBoardMemberApiDto,
  PaginatedApiResponse,
  PublicArticleApiDto,
  PublicArticleListQuery,
  PublicIssueApiDto,
  PublicJournalApiDto,
  PublicPageApiDto,
  PublicSectionApiDto,
} from "./public-api.types";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_API_BASE_URL environment variable.");
}

type RequestOptions = {
  revalidate?: number;
};
export const PUBLIC_ARTICLE_PAGE_SIZE = 10;
export type PublicArticleExportFormat = "bibtex" | "ris" | "dc";

export type PublicArticleDownloadResponse = {
  download_url: string;
  expires_in: number;
};

class PublicApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
  }
}

function buildUrl(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (!value || value === "all") {
      return;
    }

    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function publicFetch<T>(
  path: string,
  query?: Record<string, string | undefined>,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(buildUrl(path, query), {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: options.revalidate ?? 60,
    },
  });

  if (!response.ok) {
    throw new PublicApiError(
      `Public API request failed: ${path}`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

function isNotFoundError(error: unknown) {
  return error instanceof PublicApiError && error.status === 404;
}

function reportPublicFallback(resource: string, error: unknown) {
  console.error(
    `[public-api] Using controlled fallback for ${resource}.`,
    error,
  );
}

export async function getPublicJournal() {
  const dto = await publicFetch<PublicJournalApiDto>(
    "/public/journal/",
    {},
    {
      revalidate: 300,
    },
  );

  return mapJournal(dto);
}

export async function getPublicJournalSafe() {
  try {
    return await getPublicJournal();
  } catch (error) {
    reportPublicFallback("journal metadata", error);
    return null;
  }
}

export async function getPublicArticles(query: PublicArticleListQuery = {}) {
  const orderingBySort = {
    newest: "-published_at",
    oldest: "published_at",
    most_viewed: "-views",
    most_downloaded: "-downloads",
    title: "title",
  } as const;

  const ordering =
    query.ordering && query.ordering in orderingBySort
      ? orderingBySort[query.ordering as keyof typeof orderingBySort]
      : query.ordering;

  const response = await publicFetch<PaginatedApiResponse<PublicArticleApiDto>>(
    "/public/articles/",
    {
      search: query.search,
      section: query.section,
      year: query.year,
      language: query.language,
      ordering,
      page: query.page,
      page_size: query.pageSize ?? String(PUBLIC_ARTICLE_PAGE_SIZE),
    },
    { revalidate: 60 },
  );

  return {
    count: response.count,
    next: response.next,
    previous: response.previous,
    results: response.results.map(mapArticle),
  };
}

export function getPublicArticleExportUrl(
  slug: string,
  format: PublicArticleExportFormat,
) {
  return buildUrl(`/public/articles/${encodeURIComponent(slug)}/export/`, {
    format,
  });
}

export async function requestPublicArticleDownload(slug: string) {
  const response = await fetch(
    buildUrl(`/public/articles/${encodeURIComponent(slug)}/download/`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new PublicApiError(
      "The article PDF is currently unavailable.",
      response.status,
    );
  }

  const payload =
    (await response.json()) as Partial<PublicArticleDownloadResponse>;

  if (typeof payload.download_url !== "string" || !payload.download_url) {
    throw new PublicApiError(
      "The download service returned an invalid response.",
      502,
    );
  }

  return payload as PublicArticleDownloadResponse;
}

export async function getLatestPublicArticles(limit = 3) {
  const response = await publicFetch<PaginatedApiResponse<PublicArticleApiDto>>(
    "/public/articles/",
    {
      ordering: "-published_at",
      page_size: String(limit),
    },
    { revalidate: 60 },
  );

  return response.results.map(mapArticle);
}

export async function getPublicArticle(slug: string) {
  try {
    const dto = await publicFetch<PublicArticleApiDto>(
      `/public/articles/${slug}/`,
      {},
      { revalidate: 60 },
    );

    return mapArticle(dto);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPublicSections() {
  const response = await publicFetch<
    PublicSectionApiDto[] | PaginatedApiResponse<PublicSectionApiDto>
  >("/public/sections/", {}, { revalidate: 300 });

  const sections = Array.isArray(response) ? response : response.results;

  return sections.map(mapSection);
}

export async function getPublicSection(slug: string) {
  try {
    const dto = await publicFetch<PublicSectionApiDto>(
      `/public/sections/${slug}/`,
      {},
      { revalidate: 300 },
    );

    return mapSection(dto);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPublicSectionArticles(
  slug: string,
  page?: string,
  pageSize = PUBLIC_ARTICLE_PAGE_SIZE,
) {
  const response = await publicFetch<PaginatedApiResponse<PublicArticleApiDto>>(
    "/public/articles/",
    {
      section: slug,
      ordering: "-published_at",
      page,
      page_size: String(pageSize),
    },
    { revalidate: 60 },
  );

  return {
    count: response.count,
    next: response.next,
    previous: response.previous,
    results: response.results.map(mapArticle),
  };
}

export async function getPublicIssues() {
  const response = await publicFetch<
    PublicIssueApiDto[] | PaginatedApiResponse<PublicIssueApiDto>
  >("/public/issues/", {}, { revalidate: 300 });

  const issues = Array.isArray(response) ? response : response.results;

  return issues.map(mapIssue);
}

export async function getCurrentPublicIssue() {
  try {
    const dto = await publicFetch<PublicIssueApiDto>(
      "/public/issues/current/",
      {},
      { revalidate: 300 },
    );

    return mapIssue(dto);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPublicIssue(slug: string) {
  try {
    const dto = await publicFetch<PublicIssueApiDto>(
      `/public/issues/${slug}/`,
      {},
      { revalidate: 300 },
    );

    return mapIssue(dto);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getPublicIssueArticles(
  slug: string,
  page?: string,
  pageSize = PUBLIC_ARTICLE_PAGE_SIZE,
) {
  const response = await publicFetch<PaginatedApiResponse<PublicArticleApiDto>>(
    "/public/articles/",
    {
      issue: slug,
      ordering: "-published_at",
      page,
      page_size: String(pageSize),
    },
    { revalidate: 60 },
  );

  return {
    count: response.count,
    next: response.next,
    previous: response.previous,
    results: response.results.map(mapArticle),
  };
}

export async function getPublicPage(slug: string) {
  try {
    const dto = await publicFetch<PublicPageApiDto>(
      `/public/pages/${slug}/`,
      {},
      { revalidate: 300 },
    );

    return mapPublicPage(dto);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getEditorialBoard() {
  try {
    const response = await publicFetch<
      | EditorialBoardMemberApiDto[]
      | PaginatedApiResponse<EditorialBoardMemberApiDto>
    >("/public/editorial-board/", {}, { revalidate: 300 });

    const members = Array.isArray(response) ? response : response.results;

    return members.map(mapEditorialBoardMember);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getContactMethods() {
  try {
    const response = await publicFetch<
      ContactMethodApiDto[] | PaginatedApiResponse<ContactMethodApiDto>
    >("/public/contact/", {}, { revalidate: 300 });

    const contacts = Array.isArray(response) ? response : response.results;

    return contacts.map(mapContactMethod);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}
