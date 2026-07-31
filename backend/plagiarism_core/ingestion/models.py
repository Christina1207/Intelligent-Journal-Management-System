from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


DOCUMENT_INGESTION_SCHEMA = "document_ingestion_v1"


@dataclass(frozen=True)
class PageSpan:
    """Map one PDF page to offsets in the canonical extracted text."""

    page_number: int
    start_offset: int
    end_offset: int

    def __post_init__(self) -> None:
        if self.page_number < 1:
            raise ValueError("page_number must be positive.")
        if self.start_offset < 0:
            raise ValueError("start_offset cannot be negative.")
        if self.end_offset < self.start_offset:
            raise ValueError("end_offset cannot precede start_offset.")

    @property
    def character_count(self) -> int:
        return self.end_offset - self.start_offset

    def to_dict(self) -> dict[str, int]:
        return {
            "page_number": self.page_number,
            "start": self.start_offset,
            "end": self.end_offset,
            "character_count": self.character_count,
        }


@dataclass(frozen=True)
class ExtractedDocument:
    """Canonical result shared by TXT and PDF extractors."""

    document_id: str
    filename: str
    media_type: str
    file_type: str
    text: str
    extraction_method: str
    page_count: int | None = None
    page_spans: tuple[PageSpan, ...] = ()
    warnings: tuple[str, ...] = ()
    file_size_bytes: int | None = None
    file_sha256: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.document_id:
            raise ValueError("document_id cannot be empty.")
        if not self.filename:
            raise ValueError("filename cannot be empty.")
        if not self.media_type:
            raise ValueError("media_type cannot be empty.")
        if not self.file_type:
            raise ValueError("file_type cannot be empty.")
        if not self.text.strip():
            raise ValueError("Extracted document text cannot be empty.")
        if not self.extraction_method:
            raise ValueError("extraction_method cannot be empty.")
        if self.page_count is not None and self.page_count < 1:
            raise ValueError("page_count must be positive when supplied.")
        if self.page_count is None and self.page_spans:
            raise ValueError("page_spans require page_count.")
        if (
            self.page_count is not None
            and len(self.page_spans) != self.page_count
        ):
            raise ValueError(
                "PDF page_spans must contain exactly one span per page."
            )
        if self.file_size_bytes is not None and self.file_size_bytes < 0:
            raise ValueError("file_size_bytes cannot be negative.")

        previous_end = 0
        for expected_page, span in enumerate(self.page_spans, start=1):
            if span.page_number != expected_page:
                raise ValueError(
                    "page_spans must use consecutive one-based page numbers."
                )
            if span.start_offset < previous_end:
                raise ValueError("page_spans cannot overlap.")
            if span.end_offset > len(self.text):
                raise ValueError("page_span ends after extracted text.")
            previous_end = span.end_offset

    @property
    def character_count(self) -> int:
        return len(self.text)

    def pages_for_span(self, start: int, end: int) -> tuple[int, ...]:
        """Return PDF pages overlapping a half-open extracted-text span."""
        if start < 0 or end < start or end > len(self.text):
            raise ValueError("Requested span is outside extracted text.")
        return tuple(
            span.page_number
            for span in self.page_spans
            if max(start, span.start_offset) < min(end, span.end_offset)
        )

    def to_report_metadata(self) -> dict[str, Any]:
        """Return JSON-safe provenance for submitted_document.metadata."""
        payload: dict[str, Any] = {
            "schema_version": DOCUMENT_INGESTION_SCHEMA,
            "input_filename": self.filename,
            "media_type": self.media_type,
            "file_type": self.file_type,
            "file_size_bytes": self.file_size_bytes,
            "file_sha256": self.file_sha256,
            "extraction_method": self.extraction_method,
            "extracted_character_count": self.character_count,
            "page_count": self.page_count,
            "page_spans": [
                span.to_dict() for span in self.page_spans
            ],
            "warnings": list(self.warnings),
        }
        payload.update(self.metadata)
        return payload
