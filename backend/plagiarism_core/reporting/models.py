from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping


PLAGIARISM_REPORT_SCHEMA = "plagiarism_report_v1"
DEFAULT_PIPELINE_VERSION = "arabic_plagiarism_mvp_v1"
DEFAULT_FUSION_METHOD = "union_deduplicated"
DEFAULT_PLAGIARISM_TYPE = "unclassified"


@dataclass(frozen=True)
class SubmittedDocument:
    """Submitted-document information supplied by the application layer."""

    document_id: str
    title: str | None = None
    language: str = "ar"
    text: str | None = None
    character_count: int | None = None
    segment_count: int | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.document_id:
            raise ValueError("document_id cannot be empty.")
        if not self.language:
            raise ValueError("language cannot be empty.")
        if self.character_count is not None and self.character_count < 0:
            raise ValueError("character_count cannot be negative.")
        if self.segment_count is not None and self.segment_count < 0:
            raise ValueError("segment_count cannot be negative.")
        if (
            self.text is not None
            and self.character_count is not None
            and len(self.text) != self.character_count
        ):
            raise ValueError(
                "character_count must equal len(text) when both are supplied."
            )


@dataclass(frozen=True)
class ReportGenerationConfig:
    """Stable pipeline metadata recorded in every generated report."""

    schema_version: str = PLAGIARISM_REPORT_SCHEMA
    pipeline_version: str = DEFAULT_PIPELINE_VERSION
    lexical_top_k: int = 10
    semantic_top_k: int = 10
    fusion_method: str = DEFAULT_FUSION_METHOD
    plagiarism_type: str = DEFAULT_PLAGIARISM_TYPE

    # These optional values make an empty-candidate report reproducible.
    verifier_threshold: float | None = None
    verifier_checkpoint: str | None = None
    verifier_model: str | None = None
    verifier_epoch: int | None = None

    def __post_init__(self) -> None:
        if not self.schema_version:
            raise ValueError("schema_version cannot be empty.")
        if not self.pipeline_version:
            raise ValueError("pipeline_version cannot be empty.")
        if self.lexical_top_k < 1:
            raise ValueError("lexical_top_k must be positive.")
        if self.semantic_top_k < 1:
            raise ValueError("semantic_top_k must be positive.")
        if not self.fusion_method:
            raise ValueError("fusion_method cannot be empty.")
        if not self.plagiarism_type:
            raise ValueError("plagiarism_type cannot be empty.")
        if (
            self.verifier_threshold is not None
            and not 0.0 <= self.verifier_threshold <= 1.0
        ):
            raise ValueError("verifier_threshold must be in [0, 1].")
        if self.verifier_epoch is not None and self.verifier_epoch < 0:
            raise ValueError("verifier_epoch cannot be negative.")


@dataclass(frozen=True)
class ReportGenerationResult:
    """In-memory report plus small values useful to runners and Django."""

    report_id: str
    submitted_document_id: str
    report: dict[str, Any]

    @property
    def plagiarism_detected(self) -> bool:
        return bool(self.report["summary"]["plagiarism_detected"])

    @property
    def finding_count(self) -> int:
        return int(self.report["summary"]["flagged_segments_count"])

    @property
    def accepted_evidence_count(self) -> int:
        return int(self.report["summary"]["accepted_evidence_count"])

    def to_dict(self) -> dict[str, Any]:
        return self.report
