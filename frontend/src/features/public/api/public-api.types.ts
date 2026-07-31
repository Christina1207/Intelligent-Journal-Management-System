export type PaginatedApiResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type PublicJournalApiDto = {
  name: string;
  short_name?: string;
  description?: string;
  logo_url?: string | null;
  primary_color?: string;
  default_language?: string;
  issn?: string;
  publisher?: string;
  access_policy?: string;
  peer_review_policy?: string;
  publication_frequency?: string;
  license?: string;
  license_url?: string;
};

export type PublicArticleApiDto = {
  id: string;
  title: string;
  slug: string;
  authors?: string[];
  section?: string;
  section_slug?: string;
  published_at?: string;
  publishedAt?: string;
  abstract?: string;
  keywords?: string[];
  doi?: string | null;
  language?: string;
  pdf_url?: string;
  pdfUrl?: string;
  download_url?: string;
  views?: number;
  downloads?: number;
  license?: string;
  license_url?: string;
  volume?: string | null;
  issue?: string | null;
  issue_slug?: string | null;
  pages?: string | null;
  received_at?: string | null;
  accepted_at?: string | null;
  affiliations?: string[];
  author_details?: PublicArticleAuthorApiDto[];
};

export type PublicArticleAuthorApiDto = {
  full_name: string;
  orcid?: string;
  affiliation?: string;
  country?: string;
  order?: number;
  is_corresponding?: boolean;
};

export type PublicSectionApiDto = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  article_count?: number;
  articleCount?: number;
  topics?: string[];
};

export type PublicIssueApiDto = {
  id: string;
  slug: string;
  title: string;
  volume?: string;
  issue?: string;
  year?: string;
  published_at?: string;
  publishedAt?: string;
  description?: string;
  is_current?: boolean;
  isCurrent?: boolean;
};

export type PublicPageApiDto = {
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  updated_at?: string;
};

export type EditorialBoardMemberApiDto = {
  id: string;
  name: string;
  role: string;
  affiliation?: string;
  expertise?: string[];
  email?: string;
};

export type ContactMethodApiDto = {
  id: string;
  title: string;
  value: string;
  description?: string;
  href?: string;
};

export type PublicArticleListQuery = {
  search?: string;
  section?: string;
  year?: string;
  language?: string;
  ordering?: string;
  page?: string;
  pageSize?: string;
};
