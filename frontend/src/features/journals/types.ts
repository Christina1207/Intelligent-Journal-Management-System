export interface JournalSummary {
  id: string | number;
  name: string;
  slug: string;
}

export type PublicSection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  article_count: number;
  topics: string[];
};

export type SectionManagerSummary = {
  id: string;
  username: string;
  email: string;
  full_name: string;
};

export type SectionManagementRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  issn: string;
  manager: SectionManagerSummary | null;
  is_active: boolean;
  created_at: string;
  last_clustered_at: string | null;
};

export type SectionManagerCandidate = SectionManagerSummary;

export type SectionWritePayload = {
  name: string;
  description: string;
  issn: string;
};
