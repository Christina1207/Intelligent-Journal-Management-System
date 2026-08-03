from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Iterable

from plagiarism_core.ingestion.errors import (
    DocumentTooLargeError,
    InvalidDocumentError,
    UnsupportedDocumentTypeError,
)
from plagiarism_core.ingestion.extractors import (
    DocumentExtractor,
    PdfTextExtractor,
    TextFileExtractor,
)
from plagiarism_core.ingestion.models import ExtractedDocument


@dataclass(frozen=True)
class DocumentIngestionConfig:
    """Validation and extraction limits for uploaded files."""

    max_file_size_bytes: int = 50 * 1024 * 1024
    minimum_pdf_usable_characters: int = 20
    pdf_page_separator: str = "\n\n"

    def __post_init__(self) -> None:
        if self.max_file_size_bytes < 1:
            raise ValueError("max_file_size_bytes must be positive.")
        if self.minimum_pdf_usable_characters < 1:
            raise ValueError(
                "minimum_pdf_usable_characters must be positive."
            )


class DocumentIngestionService:
    """Validate a local upload and route it to the correct extractor."""

    def __init__(
        self,
        config: DocumentIngestionConfig | None = None,
        *,
        extractors: Iterable[DocumentExtractor] | None = None,
    ) -> None:
        self.config = config or DocumentIngestionConfig()
        resolved_extractors = tuple(
            extractors
            or (
                TextFileExtractor(),
                PdfTextExtractor(
                    minimum_usable_characters=(
                        self.config.minimum_pdf_usable_characters
                    ),
                    page_separator=self.config.pdf_page_separator,
                ),
            )
        )
        if not resolved_extractors:
            raise ValueError("At least one document extractor is required.")

        by_suffix: dict[str, DocumentExtractor] = {}
        for extractor in resolved_extractors:
            for suffix in extractor.suffixes:
                normalized_suffix = suffix.lower()
                if normalized_suffix in by_suffix:
                    raise ValueError(
                        f"Duplicate extractor for suffix: {normalized_suffix}"
                    )
                by_suffix[normalized_suffix] = extractor
        self._extractors_by_suffix = by_suffix

    @property
    def supported_suffixes(self) -> tuple[str, ...]:
        return tuple(sorted(self._extractors_by_suffix))

    def extract_file(
        self,
        file_path: str | Path,
        *,
        document_id: str | None = None,
        media_type: str | None = None,
    ) -> ExtractedDocument:
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(
                f"Submitted document does not exist: {path}"
            )

        file_size = path.stat().st_size
        if file_size == 0:
            raise InvalidDocumentError(
                "Submitted document file is empty."
            )
        if file_size > self.config.max_file_size_bytes:
            limit_mb = self.config.max_file_size_bytes / (1024 * 1024)
            raise DocumentTooLargeError(
                f"Submitted document exceeds the {limit_mb:g} MB limit."
            )

        suffix = path.suffix.lower()
        extractor = self._extractors_by_suffix.get(suffix)
        if extractor is None:
            supported = ", ".join(self.supported_suffixes)
            raise UnsupportedDocumentTypeError(
                f"Unsupported document type {suffix or '(no extension)'}. "
                f"Supported types: {supported}."
            )

        normalized_media_type = _normalize_media_type(media_type)
        if (
            normalized_media_type is not None
            and normalized_media_type
            not in extractor.accepted_media_types
        ):
            raise UnsupportedDocumentTypeError(
                f"File extension {suffix} does not match media type "
                f"{normalized_media_type}."
            )

        resolved_document_id = document_id or path.name
        if not resolved_document_id:
            raise ValueError("document_id cannot be empty.")

        extracted = extractor.extract(
            path,
            document_id=resolved_document_id,
        )
        return replace(
            extracted,
            file_size_bytes=file_size,
            file_sha256=_sha256(path),
        )


def _normalize_media_type(media_type: str | None) -> str | None:
    if media_type is None:
        return None
    normalized = media_type.split(";", maxsplit=1)[0].strip().lower()
    return normalized or None


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
