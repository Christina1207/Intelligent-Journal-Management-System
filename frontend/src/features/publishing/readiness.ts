import type { PublicationRecord } from "@/features/publishing/types";

export type PublicationReadinessGap = {
  key: string;
  label: string;
};

export function getPublicationReadinessGaps(
  record: PublicationRecord,
): PublicationReadinessGap[] {
  const gaps: PublicationReadinessGap[] = [];

  if (!record.publication_issue) {
    gaps.push({ key: "publication_issue", label: "Publication issue" });
  }

  if (!record.title.trim()) {
    gaps.push({ key: "title", label: "Title" });
  }

  if (!record.abstract.trim()) {
    gaps.push({ key: "abstract", label: "Abstract" });
  }

  if (!record.language.trim()) {
    gaps.push({ key: "language", label: "Language" });
  }

  if (record.keywords.length === 0) {
    gaps.push({ key: "keywords", label: "Keywords" });
  }

  if (!record.license_name.trim() || !record.license_url.trim()) {
    gaps.push({ key: "license", label: "License name and URL" });
  }

  if (!record.pdf_file) {
    gaps.push({ key: "pdf_file", label: "Accepted manuscript PDF" });
  }

  if (record.authors.length === 0 && record.author_details.length === 0) {
    gaps.push({ key: "authors", label: "Author snapshot" });
  }

  return gaps;
}
