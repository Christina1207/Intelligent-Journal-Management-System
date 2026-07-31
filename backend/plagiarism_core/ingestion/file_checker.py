from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from plagiarism_core.ingestion.models import ExtractedDocument
from plagiarism_core.ingestion.service import DocumentIngestionService
from plagiarism_core.pipeline.orchestrator import (
    InMemoryPlagiarismPipeline,
    PlagiarismCheckResult,
)


@dataclass(frozen=True)
class FilePlagiarismCheckResult:
    """Combined ingestion and plagiarism-pipeline result."""

    extracted_document: ExtractedDocument
    plagiarism_result: PlagiarismCheckResult

    @property
    def report(self) -> dict[str, Any]:
        return self.plagiarism_result.report


class FilePlagiarismChecker:
    """
    File-facing application boundary above the text-only core pipeline.

    Django may store an upload temporarily and call check_file(). The core
    pipeline remains independently reusable through check_document().
    """

    def __init__(
        self,
        pipeline: InMemoryPlagiarismPipeline,
        *,
        ingestion_service: DocumentIngestionService | None = None,
    ) -> None:
        if not callable(getattr(pipeline, "check_document", None)):
            raise TypeError("pipeline must expose check_document(...).")
        self.pipeline = pipeline
        self.ingestion_service = (
            ingestion_service or DocumentIngestionService()
        )

    def check_file(
        self,
        file_path: str | Path,
        *,
        document_id: str | None = None,
        title: str | None = None,
        language: str = "ar",
        media_type: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> FilePlagiarismCheckResult:
        extracted = self.ingestion_service.extract_file(
            file_path,
            document_id=document_id,
            media_type=media_type,
        )
        return self.check_extracted_document(
            extracted,
            title=title,
            language=language,
            metadata=metadata,
        )

    def check_extracted_document(
        self,
        extracted: ExtractedDocument,
        *,
        title: str | None = None,
        language: str = "ar",
        metadata: Mapping[str, Any] | None = None,
    ) -> FilePlagiarismCheckResult:
        report_metadata = dict(metadata or {})
        if "ingestion" in report_metadata:
            raise ValueError(
                "metadata.ingestion is reserved for extraction provenance."
            )
        report_metadata.setdefault(
            "input_filename",
            extracted.filename,
        )
        report_metadata["ingestion"] = extracted.to_report_metadata()

        result = self.pipeline.check_document(
            document_id=extracted.document_id,
            text=extracted.text,
            title=title or extracted.filename,
            language=language,
            metadata=report_metadata,
        )
        return FilePlagiarismCheckResult(
            extracted_document=extracted,
            plagiarism_result=result,
        )
