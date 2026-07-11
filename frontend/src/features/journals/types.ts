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
