from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from plagiarism_core.ingestion.errors import (
    EncryptedPdfError,
    InvalidDocumentError,
    PdfOcrRequiredError,
)
from plagiarism_core.ingestion.models import (
    ExtractedDocument,
    PageSpan,
)


class DocumentExtractor(Protocol):
    """Convert one supported file type into canonical extracted text."""

    file_type: str
    media_type: str
    suffixes: frozenset[str]
    accepted_media_types: frozenset[str]

    def extract(
        self,
        file_path: Path,
        *,
        document_id: str,
    ) -> ExtractedDocument:
        ...


@dataclass(frozen=True)
class TextFileExtractor:
    """Read UTF-8 or UTF-8-with-BOM plain-text submissions."""

    file_type: str = "txt"
    media_type: str = "text/plain"
    suffixes: frozenset[str] = frozenset({".txt"})
    accepted_media_types: frozenset[str] = frozenset(
        {"text/plain", "application/octet-stream"}
    )

    def extract(
        self,
        file_path: Path,
        *,
        document_id: str,
    ) -> ExtractedDocument:
        try:
            text = file_path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError as exc:
            raise InvalidDocumentError(
                "TXT submissions must use UTF-8 encoding."
            ) from exc
        except OSError as exc:
            raise InvalidDocumentError(
                f"Could not read TXT submission: {file_path.name}"
            ) from exc

        if "\x00" in text:
            raise InvalidDocumentError(
                "TXT submission contains binary null bytes."
            )
        if not text.strip():
            raise InvalidDocumentError(
                "TXT submission contains no usable text."
            )

        return ExtractedDocument(
            document_id=document_id,
            filename=file_path.name,
            media_type=self.media_type,
            file_type=self.file_type,
            text=text,
            extraction_method="utf8_text",
        )


@dataclass(frozen=True)
class PdfTextExtractor:
    """
    Extract embedded text from a text-based PDF.

    OCR is intentionally outside the C1 scope. A PDF with too little embedded
    text raises PdfOcrRequiredError instead of silently producing an empty
    plagiarism report.
    """

    minimum_usable_characters: int = 20
    page_separator: str = "\n\n"
    file_type: str = "pdf"
    media_type: str = "application/pdf"
    suffixes: frozenset[str] = frozenset({".pdf"})
    accepted_media_types: frozenset[str] = frozenset(
        {
            "application/pdf",
            "application/x-pdf",
            "application/octet-stream",
        }
    )

    def __post_init__(self) -> None:
        if self.minimum_usable_characters < 1:
            raise ValueError(
                "minimum_usable_characters must be positive."
            )
        if not isinstance(self.page_separator, str):
            raise TypeError("page_separator must be a string.")

    def extract(
        self,
        file_path: Path,
        *,
        document_id: str,
    ) -> ExtractedDocument:
        self._validate_pdf_signature(file_path)
        reader_type = _load_pdf_reader()
        try:
            reader = reader_type(str(file_path), strict=False)
        except Exception as exc:
            raise InvalidDocumentError(
                f"PDF submission is malformed or unreadable: {file_path.name}"
            ) from exc

        if bool(getattr(reader, "is_encrypted", False)):
            raise EncryptedPdfError(
                "Password-protected PDFs are not supported. "
                "Submit an unlocked PDF."
            )

        try:
            pages = list(reader.pages)
        except Exception as exc:
            raise InvalidDocumentError(
                f"Could not read PDF pages: {file_path.name}"
            ) from exc
        if not pages:
            raise InvalidDocumentError("PDF submission contains no pages.")

        page_texts: list[str] = []
        extraction_failures: list[int] = []
        for page_number, page in enumerate(pages, start=1):
            try:
                page_text = page.extract_text() or ""
            except Exception:
                page_text = ""
                extraction_failures.append(page_number)
            page_texts.append(_normalize_line_endings(page_text))

        text, page_spans = self._join_pages(page_texts)
        usable_character_count = sum(
            not character.isspace() for character in text
        )
        if usable_character_count < self.minimum_usable_characters:
            raise PdfOcrRequiredError(
                "No usable embedded text was extracted from the PDF. "
                "It is probably scanned and requires OCR, which is outside "
                "the current C1 scope."
            )

        empty_pages = [
            page_number
            for page_number, page_text in enumerate(page_texts, start=1)
            if not page_text.strip()
        ]
        warnings: list[str] = []
        if empty_pages:
            warnings.append(
                f"{len(empty_pages)} of {len(pages)} PDF pages contained "
                "no extractable text; they may be blank or scanned."
            )
        if extraction_failures:
            warnings.append(
                "Text extraction failed on PDF page(s): "
                + ", ".join(str(item) for item in extraction_failures)
                + "."
            )

        return ExtractedDocument(
            document_id=document_id,
            filename=file_path.name,
            media_type=self.media_type,
            file_type=self.file_type,
            text=text,
            extraction_method="pypdf_text",
            page_count=len(pages),
            page_spans=page_spans,
            warnings=tuple(warnings),
        )

    def _join_pages(
        self,
        page_texts: list[str],
    ) -> tuple[str, tuple[PageSpan, ...]]:
        parts: list[str] = []
        spans: list[PageSpan] = []
        cursor = 0
        for index, page_text in enumerate(page_texts):
            start = cursor
            parts.append(page_text)
            cursor += len(page_text)
            spans.append(
                PageSpan(
                    page_number=index + 1,
                    start_offset=start,
                    end_offset=cursor,
                )
            )
            if index < len(page_texts) - 1:
                parts.append(self.page_separator)
                cursor += len(self.page_separator)
        return "".join(parts), tuple(spans)

    @staticmethod
    def _validate_pdf_signature(file_path: Path) -> None:
        try:
            with file_path.open("rb") as file:
                header = file.read(1024)
        except OSError as exc:
            raise InvalidDocumentError(
                f"Could not read PDF submission: {file_path.name}"
            ) from exc
        if b"%PDF-" not in header:
            raise InvalidDocumentError(
                "The submitted .pdf file does not contain a valid PDF header."
            )


def _load_pdf_reader():
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError(
            "PDF extraction requires pypdf. "
            "Run: python -m pip install -r requirements.txt"
        ) from exc
    return PdfReader


def _normalize_line_endings(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")
