export type PublicArticle = {
  id: string;
  title: string;
  slug: string;
  authors: string[];
  section: string;
  sectionSlug?: string;
  publishedAt: string;
  abstract: string;
  keywords: string[];
  doi?: string;
  language: "English" | "Arabic" | "French" | string;

  views: number;
  downloads: number;
  license: string;
  licenseUrl?: string;

  volume?: string;
  issue?: string;
  issueSlug?: string;
  pages?: string;
  receivedAt?: string;
  acceptedAt?: string;
  affiliations?: string[];
  authorDetails?: PublicArticleAuthor[];
};

export type PublicArticleAuthor = {
  fullName: string;
  orcid?: string;
  affiliation?: string;
  country?: string;
  order: number;
  isCorresponding: boolean;
};

export type PublicSection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  articleCount: number;
  topics: string[];
};

export type PublicIssue = {
  id: string;
  slug: string;
  title: string;
  volume: string;
  issue: string;
  year: string;
  publishedAt: string;
  description: string;
  isCurrent: boolean;
};

export type JournalInfo = {
  name: string;
  shortName: string;
  description: string;
  logoUrl?: string;
  primaryColor: string;
  defaultLanguage: string;
  issn: string;
  publisher: string;
  accessPolicy: string;
  peerReviewPolicy: string;
  publicationFrequency: string;
  license: string;
  licenseUrl?: string;
};

export type PublicPageContent = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  updatedAt?: string;
};
export type InfoSection = {
  id: string;
  title: string;
  body: string;
  items?: string[];
};
