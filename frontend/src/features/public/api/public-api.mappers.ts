import type {
  ContactMethodApiDto,
  EditorialBoardMemberApiDto,
  PublicArticleApiDto,
  PublicIssueApiDto,
  PublicJournalApiDto,
  PublicPageApiDto,
  PublicSectionApiDto,
} from "./public-api.types";
import type {
  ContactMethod,
  EditorialBoardMember,
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
    issn: valueOrFallback(dto.issn, "Not assigned"),
    publisher: valueOrFallback(dto.publisher, ""),
    accessPolicy: valueOrFallback(dto.access_policy, "Open Access"),
    peerReviewPolicy: valueOrFallback(dto.peer_review_policy, "Peer Reviewed"),
    publicationFrequency: valueOrFallback(
      dto.publication_frequency,
      "Continuous publication",
    ),
    license: valueOrFallback(dto.license, "Not specified"),
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
    publishedAt: valueOrFallback(publishedAt, new Date().toISOString()),
    abstract: valueOrFallback(dto.abstract, ""),
    keywords: dto.keywords ?? [],
    doi: dto.doi ?? undefined,
    language: valueOrFallback(dto.language, "English"),
    pdfUrl: dto.pdf_url ?? dto.pdfUrl ?? dto.download_url ?? "#",
    views: dto.views ?? 0,
    downloads: dto.downloads ?? 0,
    license: valueOrFallback(dto.license, "Not specified"),

    volume: dto.volume ?? undefined,
    issue: dto.issue ?? undefined,
    issueSlug: dto.issue_slug ?? undefined,
    pages: dto.pages ?? undefined,
    receivedAt: dto.received_at ?? undefined,
    acceptedAt: dto.accepted_at ?? undefined,
    affiliations: dto.affiliations ?? [],
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
    publishedAt: valueOrFallback(publishedAt, new Date().toISOString()),
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

export function mapEditorialBoardMember(
  dto: EditorialBoardMemberApiDto,
): EditorialBoardMember {
  return {
    id: dto.id,
    name: dto.name,
    role: dto.role,
    affiliation: dto.affiliation ?? "",
    expertise: dto.expertise ?? [],
    email: dto.email,
  };
}

export function mapContactMethod(dto: ContactMethodApiDto): ContactMethod {
  return {
    id: dto.id,
    title: dto.title,
    value: dto.value,
    description: dto.description ?? "",
    href: dto.href,
  };
}
