export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  authors: string[];
  section: string;
  publishedAt: string;
  abstract: string;
  keywords: string[];
  doi?: string;
  language: "English" | "Arabic" | "French";
  pdfUrl: string;
  views: number;
  downloads: number;
  license: string;

  volume?: string;
  issue?: string;
  pages?: string;
  receivedAt?: string;
  acceptedAt?: string;
  affiliations?: string[];
};

export type PublicSection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount: number;
  topics: string[];
};

export type JournalInfo = {
  name: string;
  shortName: string;
  description: string;
  issn: string;
  publisher: string;
  accessPolicy: string;
  peerReviewPolicy: string;
  publicationFrequency: string;
  license: string;
};
