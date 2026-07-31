import type {
  PublicArticleApiDto,
  PublicIssueApiDto,
  PublicJournalApiDto,
  PublicPageApiDto,
  PublicSectionApiDto,
} from "./public-api.types";
import type {
  JournalInfo,
  PublicArticle,
  PublicIssue,
  PublicPageContent,
  PublicSection,
} from "../types";

function valueOrFallback(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value : fallback;
}

export function mapJournal(dto: PublicJournalApiDto): JournalInfo {
  return {
    name: valueOrFallback(dto.name, "Journal"),
    shortName: valueOrFallback(dto.short_name, dto.name),
    description: valueOrFallback(dto.description, ""),
    logoUrl: dto.logo_url || undefined,
    primaryColor: valueOrFallback(dto.primary_color, "#17324d"),
    defaultLanguage: valueOrFallback(dto.default_language, "en"),
    issn: valueOrFallback(dto.issn, ""),
    publisher: valueOrFallback(dto.publisher, ""),
    accessPolicy: valueOrFallback(dto.access_policy, ""),
    peerReviewPolicy: valueOrFallback(dto.peer_review_policy, ""),
    publicationFrequency: valueOrFallback(dto.publication_frequency, ""),
    license: valueOrFallback(dto.license, ""),
    licenseUrl: dto.license_url || undefined,
  };
}

export function mapArticle(dto: PublicArticleApiDto): PublicArticle {
  const publishedAt = dto.published_at ?? dto.publishedAt;

  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    authors: dto.authors ?? [],
    section: valueOrFallback(dto.section, "Uncategorized"),
    sectionSlug: dto.section_slug,
    publishedAt: valueOrFallback(publishedAt, ""),
    abstract: valueOrFallback(dto.abstract, ""),
    keywords: dto.keywords ?? [],
    doi: dto.doi ?? undefined,
    language: valueOrFallback(dto.language, "English"),
    views: dto.views ?? 0,
    downloads: dto.downloads ?? 0,
    license: valueOrFallback(dto.license, ""),
    licenseUrl: dto.license_url || undefined,

    volume: dto.volume ?? undefined,
    issue: dto.issue ?? undefined,
    issueSlug: dto.issue_slug ?? undefined,
    pages: dto.pages ?? undefined,
    receivedAt: dto.received_at ?? undefined,
    acceptedAt: dto.accepted_at ?? undefined,
    affiliations: dto.affiliations ?? [],
    authorDetails: dto.author_details?.map((author) => ({
      fullName: author.full_name,
      orcid: author.orcid || undefined,
      affiliation: author.affiliation || undefined,
      country: author.country || undefined,
      order: author.order ?? 0,
      isCorresponding: author.is_corresponding ?? false,
    })),
  };
}

export function mapSection(dto: PublicSectionApiDto): PublicSection {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    description: valueOrFallback(dto.description, ""),
    articleCount: dto.article_count ?? dto.articleCount ?? 0,
    topics: dto.topics ?? [],
  };
}

export function mapIssue(dto: PublicIssueApiDto): PublicIssue {
  const publishedAt = dto.published_at ?? dto.publishedAt;

  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    volume: valueOrFallback(dto.volume, ""),
    issue: valueOrFallback(dto.issue, ""),
    year: valueOrFallback(dto.year, ""),
    publishedAt: valueOrFallback(publishedAt, ""),
    description: valueOrFallback(dto.description, ""),
    isCurrent: dto.is_current ?? dto.isCurrent ?? false,
  };
}

export function mapPublicPage(dto: PublicPageApiDto): PublicPageContent {
  return {
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt ?? "",
    content: dto.content,
    updatedAt: dto.updated_at,
  };
}
