export type PublicationDraftStatus = "DRAFT" | "PUBLISHED" | "RETRACTED";

export type PublicationDraft = {
  id: string;
  submission_id: string;
  source_version: string;
  title: string;
  slug: string;
  abstract: string;
  language: string;
  keywords: string[];
  section: string;
  section_slug: string;
  status: PublicationDraftStatus;
  created_at: string;
  updated_at: string;
};
