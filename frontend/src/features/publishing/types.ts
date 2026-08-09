import type { PaginatedApiResponse } from "@/types/api";

export type IssueStatus = "draft" | "published" | "archived";

export type IssueManagementRecord = {
  id: string;
  title: string;
  slug: string;
  volume: string;
  number: string;
  year: number;
  description: string;
  status: IssueStatus;
  is_current: boolean;
  published_at: string | null;
  article_count: number;
  published_article_count: number;
  draft_article_count: number;
  created_at: string;
  updated_at: string;
};

export type IssueWritePayload = {
  title: string;
  volume: string;
  number: string;
  year: number;
  description: string;
};

export type PublicationStatus = "draft" | "published" | "retracted";

export type PublicationDraftStatus = PublicationStatus;

export type PublicationAuthor = {
  id?: string;
  full_name: string;
  email?: string;
  orcid: string;
  affiliation: string;
  country: string;
  order: number;
  is_corresponding: boolean;
};

export type PublicationRecord = {
  id: string;
  submission_id: string;
  source_version: string | null;
  publication_issue: string | null;
  title: string;
  slug: string;
  abstract: string;
  authors: PublicationAuthor[];
  author_details: PublicationAuthor[];
  language: string;
  keywords: string[];
  doi: string | null;
  license: string;
  license_name: string;
  license_url: string;
  volume: string | null;
  issue: string | null;
  issue_slug: string | null;
  first_page: string;
  last_page: string;
  pages: string | null;
  section: string;
  section_slug: string;
  section_id: string;
  section_name: string;
  pdf_file: string | null;
  pdf_url: string;
  download_url: string;
  status: PublicationStatus;
  published_at: string | null;
  views: number;
  downloads: number;
  view_count: number;
  download_count: number;
  received_at: string | null;
  accepted_at: string | null;
  affiliations: string[];
  metadata_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicationDraft = PublicationRecord;

export type PublicationUpdatePayload = {
  publication_issue?: string | null;
  title?: string;
  abstract?: string;
  language?: string;
  keywords?: string[];
  doi?: string | null;
  license_name?: string;
  license_url?: string;
  first_page?: string;
  last_page?: string;
};

export type PublicationRecordListResponse =
  PaginatedApiResponse<PublicationRecord>;
