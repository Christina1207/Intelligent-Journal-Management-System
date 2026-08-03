from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping, Sequence
from uuid import uuid4

from plagiarism_core.reporting.models import (
    ReportGenerationConfig,
    ReportGenerationResult,
    SubmittedDocument,
)
from plagiarism_core.schemas import HUMAN_REVIEW_MESSAGE


class PlagiarismReportBuilder:
    """
    Convert report-ready pair predictions into one production report.

    The builder never consumes ExAra labels or XML annotations. Accepted pairs
    are grouped by their submitted segment, while every distinct source
    segment remains separate evidence for the editor-facing UI.
    """

    def __init__(
        self,
        config: ReportGenerationConfig | None = None,
    ) -> None:
        self.config = config or ReportGenerationConfig()

    def build(
        self,
        prediction_records: Iterable[Mapping[str, Any]],
        submitted_document: SubmittedDocument,
        *,
        report_id: str | None = None,
        generated_at: datetime | None = None,
    ) -> ReportGenerationResult:
        resolved_report_id = report_id or f"report-{uuid4()}"
        if not resolved_report_id:
            raise ValueError("report_id cannot be empty.")

        resolved_generated_at = generated_at or datetime.now(timezone.utc)
        if resolved_generated_at.tzinfo is None:
            raise ValueError("generated_at must be timezone-aware.")

        document_records: list[dict[str, Any]] = []
        for line_number, raw_record in enumerate(
            prediction_records,
            start=1,
        ):
            if not isinstance(raw_record, Mapping):
                raise ValueError(
                    f"Prediction record {line_number} must be an object."
                )
            if (
                raw_record.get("submitted_document_id")
                == submitted_document.document_id
            ):
                document_records.append(dict(raw_record))

        pipeline = self._pipeline_summary(document_records)
        accepted = [
            self._accepted_evidence(record)
            for record in document_records
            if self._is_accepted(record)
        ]
        accepted = self._deduplicate_evidence(accepted)
        findings = self._build_findings(accepted)

        observed_end = max(
            (
                self._offsets(record, "submitted_offsets")["end"]
                for record in document_records
                if isinstance(record.get("submitted_offsets"), Mapping)
            ),
            default=0,
        )
        character_count, character_count_source = (
            self._document_character_count(
                submitted_document,
                observed_end=observed_end,
            )
        )
        self._validate_finding_offsets(
            findings,
            character_count,
            document_text=submitted_document.text,
        )

        segment_count = self._document_segment_count(
            submitted_document,
            document_records,
        )
        flagged_spans = [
            finding["suspicious_segment"]["offsets"] for finding in findings
        ]
        flagged_character_count = self._union_length(flagged_spans)
        flagged_coverage_percent = (
            (flagged_character_count / character_count) * 100.0
            if character_count
            else 0.0
        )
        source_summaries = self._source_summaries(findings)
        highest_probability = max(
            (
                evidence["scores"]["verifier_probability"]
                for finding in findings
                for evidence in finding["evidence"]
            ),
            default=0.0,
        )
        accepted_evidence_count = sum(
            len(finding["evidence"]) for finding in findings
        )
        plagiarism_detected = bool(findings)

        report = {
            "schema_version": self.config.schema_version,
            "report_metadata": {
                "report_id": resolved_report_id,
                "generated_at": resolved_generated_at.astimezone(
                    timezone.utc
                ).isoformat(),
                "status": "completed",
                "requires_human_review": plagiarism_detected,
                "review_message": (
                    HUMAN_REVIEW_MESSAGE if plagiarism_detected else None
                ),
            },
            "submitted_document": {
                "document_id": submitted_document.document_id,
                "title": (
                    submitted_document.title or submitted_document.document_id
                ),
                "language": submitted_document.language,
                "character_count": character_count,
                "character_count_source": character_count_source,
                "segment_count": segment_count,
                "text": submitted_document.text,
                "metadata": dict(submitted_document.metadata),
            },
            "pipeline": pipeline,
            "summary": {
                "plagiarism_detected": plagiarism_detected,
                "flagged_segments_count": len(findings),
                "flagged_character_count": flagged_character_count,
                "flagged_coverage_percent": flagged_coverage_percent,
                "accepted_evidence_count": accepted_evidence_count,
                "matched_source_documents_count": len(source_summaries),
                "highest_verifier_probability": highest_probability,
                "plagiarism_types": (
                    [self.config.plagiarism_type]
                    if plagiarism_detected
                    else []
                ),
            },
            "source_summaries": source_summaries,
            "findings": findings,
        }
        return ReportGenerationResult(
            report_id=resolved_report_id,
            submitted_document_id=submitted_document.document_id,
            report=report,
        )

    def _pipeline_summary(
        self,
        records: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        threshold = self._consistent_verification_value(
            records,
            "threshold",
            fallback=self.config.verifier_threshold,
        )
        checkpoint = self._consistent_verification_value(
            records,
            "checkpoint_id",
            fallback=self.config.verifier_checkpoint,
        )
        model = self._consistent_verification_value(
            records,
            "model_name",
            fallback=self.config.verifier_model,
        )
        epoch = self._consistent_verification_value(
            records,
            "checkpoint_epoch",
            fallback=self.config.verifier_epoch,
        )
        return {
            "pipeline_version": self.config.pipeline_version,
            "retrieval": {
                "lexical_top_k": self.config.lexical_top_k,
                "semantic_top_k": self.config.semantic_top_k,
                "fusion_method": self.config.fusion_method,
            },
            "verifier": {
                "model_id": model,
                "checkpoint": checkpoint,
                "checkpoint_epoch": epoch,
                "threshold": threshold,
            },
        }

    @staticmethod
    def _consistent_verification_value(
        records: Sequence[Mapping[str, Any]],
        key: str,
        *,
        fallback: Any,
    ) -> Any:
        values: list[Any] = []
        for record in records:
            verification = record.get("verification")
            if not isinstance(verification, Mapping):
                raise ValueError(
                    f"Pair {record.get('pair_id')!r} has no verification object."
                )
            value = verification.get(key)
            if value is not None and value not in values:
                values.append(value)

        if len(values) > 1:
            raise ValueError(
                f"Predictions contain inconsistent verification.{key} values."
            )
        if values:
            if fallback is not None and values[0] != fallback:
                raise ValueError(
                    f"Configured verifier {key} does not match predictions."
                )
            return values[0]
        return fallback

    @staticmethod
    def _is_accepted(record: Mapping[str, Any]) -> bool:
        verification = record.get("verification")
        if not isinstance(verification, Mapping):
            raise ValueError(
                f"Pair {record.get('pair_id')!r} has no verification object."
            )
        prediction = verification.get("prediction")
        if prediction not in {0, 1} or isinstance(prediction, bool):
            raise ValueError(
                "verification.prediction must be binary integer 0 or 1."
            )
        return prediction == 1

    def _accepted_evidence(
        self,
        record: Mapping[str, Any],
    ) -> dict[str, Any]:
        pair_id = self._required_string(record, "pair_id")
        submitted_segment_index = self._required_integer(
            record,
            "submitted_segment_index",
        )
        source_document_id = self._required_string(
            record,
            "source_document_id",
        )
        source_segment_index = self._required_integer(
            record,
            "source_segment_index",
        )
        submitted_offsets = self._offsets(record, "submitted_offsets")
        source_offsets = self._offsets(record, "source_offsets")

        verification = record["verification"]
        probability = self._probability(verification)
        threshold = self._optional_probability(
            verification.get("threshold"),
            "verification.threshold",
        )
        retrieval = record.get("retrieval")
        if not isinstance(retrieval, Mapping):
            raise ValueError(f"Pair {pair_id!r} has no retrieval object.")

        rank = retrieval.get("rank")
        if (
            not isinstance(rank, int)
            or isinstance(rank, bool)
            or rank < 1
        ):
            raise ValueError("retrieval.rank must be a positive integer.")

        lexical_details = self._mapping_or_none(
            retrieval.get("lexical_score"),
            "retrieval.lexical_score",
        )
        semantic_details = self._mapping_or_none(
            retrieval.get("semantic_score"),
            "retrieval.semantic_score",
        )
        methods = retrieval.get("retrieval_methods") or []
        if not isinstance(methods, (list, tuple)):
            raise ValueError("retrieval.retrieval_methods must be a list.")

        source_segment_id = record.get("source_segment_id")
        if source_segment_id is not None and (
            not isinstance(source_segment_id, int)
            or isinstance(source_segment_id, bool)
        ):
            raise ValueError("source_segment_id must be an integer or null.")

        return {
            "_deduplication_key": (
                submitted_segment_index,
                submitted_offsets["start"],
                submitted_offsets["end"],
                source_document_id,
                source_segment_id,
                source_segment_index,
                source_offsets["start"],
                source_offsets["end"],
            ),
            "_submitted_key": (
                submitted_segment_index,
                submitted_offsets["start"],
                submitted_offsets["end"],
            ),
            "_retrieval_rank": rank,
            "evidence_id": pair_id,
            "source_document": {
                "document_id": source_document_id,
                "title": (
                    record.get("source_document_title")
                    or source_document_id
                ),
                "language": record.get("source_language"),
            },
            "source_segment": {
                "segment_id": source_segment_id,
                "segment_index": source_segment_index,
                "offsets": source_offsets,
                "text": (
                    record.get("source_original_text")
                    or record.get("source_text")
                    or ""
                ),
            },
            "scores": {
                "verifier_probability": probability,
                "combined_retrieval_score": self._optional_finite_number(
                    retrieval.get("combined_ranking_score"),
                    "retrieval.combined_ranking_score",
                ),
                "lexical_score": self._final_retrieval_score(
                    lexical_details,
                    (
                        "final_score",
                        "final_lexical_score",
                        "bm25_normalized_score",
                    ),
                ),
                "semantic_score": self._final_retrieval_score(
                    semantic_details,
                    (
                        "final_score",
                        "final_semantic_score",
                        "similarity_score",
                    ),
                ),
            },
            "retrieval": {
                "rank": rank,
                "methods": list(dict.fromkeys(str(item) for item in methods)),
                "lexical_rank": retrieval.get("lexical_rank"),
                "semantic_rank": retrieval.get("semantic_rank"),
                "lexical_details": lexical_details,
                "semantic_details": semantic_details,
            },
            "verification": {
                "threshold": threshold,
                "model_id": verification.get("model_name"),
                "checkpoint": verification.get("checkpoint_id"),
                "checkpoint_epoch": verification.get("checkpoint_epoch"),
            },
            "plagiarism_type": self.config.plagiarism_type,
            "requires_human_review": True,
            "_submitted_segment": {
                "segment_index": submitted_segment_index,
                "offsets": submitted_offsets,
                "language": record.get("submitted_language"),
                "text": (
                    record.get("submitted_original_text")
                    or record.get("submitted_text")
                    or ""
                ),
            },
        }

    @staticmethod
    def _deduplicate_evidence(
        evidence: Sequence[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        strongest_by_key: dict[tuple[Any, ...], dict[str, Any]] = {}
        for item in evidence:
            key = item["_deduplication_key"]
            current = strongest_by_key.get(key)
            if current is None or (
                item["scores"]["verifier_probability"],
                -item["_retrieval_rank"],
                item["evidence_id"],
            ) > (
                current["scores"]["verifier_probability"],
                -current["_retrieval_rank"],
                current["evidence_id"],
            ):
                strongest_by_key[key] = item
        return list(strongest_by_key.values())

    @staticmethod
    def _build_findings(
        evidence: Sequence[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        grouped: dict[tuple[int, int, int], list[dict[str, Any]]] = (
            defaultdict(list)
        )
        for item in evidence:
            grouped[item["_submitted_key"]].append(item)

        findings: list[dict[str, Any]] = []
        for finding_number, submitted_key in enumerate(
            sorted(grouped),
            start=1,
        ):
            group = sorted(
                grouped[submitted_key],
                key=lambda item: (
                    -item["scores"]["verifier_probability"],
                    item["_retrieval_rank"],
                    item["source_document"]["document_id"],
                    item["source_segment"]["segment_index"],
                    item["evidence_id"],
                ),
            )
            suspicious_segment = dict(group[0]["_submitted_segment"])
            clean_evidence = []
            for item in group:
                clean_evidence.append(
                    {
                        key: value
                        for key, value in item.items()
                        if not key.startswith("_")
                    }
                )
            findings.append(
                {
                    "finding_id": f"finding-{finding_number:06d}",
                    "status": "potential_plagiarism",
                    "finding_probability": max(
                        item["scores"]["verifier_probability"]
                        for item in group
                    ),
                    "suspicious_segment": suspicious_segment,
                    "evidence": clean_evidence,
                    "requires_human_review": True,
                }
            )
        return findings

    def _source_summaries(
        self,
        findings: Sequence[Mapping[str, Any]],
    ) -> list[dict[str, Any]]:
        grouped: dict[str, dict[str, Any]] = {}
        for finding in findings:
            offsets = finding["suspicious_segment"]["offsets"]
            seen_in_finding: set[str] = set()
            for evidence in finding["evidence"]:
                source = evidence["source_document"]
                document_id = source["document_id"]
                summary = grouped.setdefault(
                    document_id,
                    {
                        "source_document_id": document_id,
                        "title": source["title"],
                        "language": source["language"],
                        "evidence_count": 0,
                        "finding_ids": [],
                        "_flagged_spans": [],
                        "highest_verifier_probability": 0.0,
                    },
                )
                summary["evidence_count"] += 1
                summary["highest_verifier_probability"] = max(
                    summary["highest_verifier_probability"],
                    evidence["scores"]["verifier_probability"],
                )
                if document_id not in seen_in_finding:
                    summary["finding_ids"].append(finding["finding_id"])
                    summary["_flagged_spans"].append(offsets)
                    seen_in_finding.add(document_id)

        results = []
        for summary in grouped.values():
            flagged_character_count = self._union_length(
                summary.pop("_flagged_spans")
            )
            finding_ids = summary.pop("finding_ids")
            summary["flagged_segments_supported"] = len(finding_ids)
            summary["flagged_character_count"] = flagged_character_count
            results.append(summary)
        results.sort(
            key=lambda item: (
                -item["flagged_character_count"],
                -item["flagged_segments_supported"],
                -item["highest_verifier_probability"],
                item["source_document_id"],
            )
        )
        return results

    @staticmethod
    def _document_character_count(
        document: SubmittedDocument,
        *,
        observed_end: int,
    ) -> tuple[int, str]:
        if document.text is not None:
            return len(document.text), "submitted_document_text"
        if document.character_count is not None:
            return document.character_count, "provided_character_count"
        return observed_end, "inferred_from_max_segment_end"

    @staticmethod
    def _document_segment_count(
        document: SubmittedDocument,
        records: Sequence[Mapping[str, Any]],
    ) -> int:
        if document.segment_count is not None:
            return document.segment_count

        recorded_counts = {
            record["submitted_document_segment_count"]
            for record in records
            if isinstance(
                record.get("submitted_document_segment_count"),
                int,
            )
            and not isinstance(
                record.get("submitted_document_segment_count"),
                bool,
            )
        }
        if len(recorded_counts) > 1:
            raise ValueError(
                "Predictions contain inconsistent submitted segment counts."
            )
        if recorded_counts:
            return recorded_counts.pop()

        indices = {
            record.get("submitted_segment_index")
            for record in records
            if isinstance(record.get("submitted_segment_index"), int)
            and not isinstance(record.get("submitted_segment_index"), bool)
        }
        return len(indices)

    @staticmethod
    def _validate_finding_offsets(
        findings: Sequence[Mapping[str, Any]],
        character_count: int,
        *,
        document_text: str | None,
    ) -> None:
        for finding in findings:
            segment = finding["suspicious_segment"]
            offsets = segment["offsets"]
            if offsets["end"] > character_count:
                raise ValueError(
                    "A suspicious segment ends after the submitted document."
                )
            if (
                document_text is not None
                and document_text[offsets["start"] : offsets["end"]]
                != segment["text"]
            ):
                raise ValueError(
                    "Suspicious segment text does not match the supplied "
                    "document at its recorded offsets."
                )

    @staticmethod
    def _union_length(spans: Sequence[Mapping[str, int]]) -> int:
        if not spans:
            return 0
        ordered = sorted(
            (int(span["start"]), int(span["end"])) for span in spans
        )
        total = 0
        current_start, current_end = ordered[0]
        for start, end in ordered[1:]:
            if start <= current_end:
                current_end = max(current_end, end)
                continue
            total += current_end - current_start
            current_start, current_end = start, end
        return total + current_end - current_start

    @staticmethod
    def _offsets(
        record: Mapping[str, Any],
        key: str,
    ) -> dict[str, int]:
        value = record.get(key)
        if not isinstance(value, Mapping):
            raise ValueError(f"{key} must be an object.")
        start = value.get("start")
        end = value.get("end")
        if (
            not isinstance(start, int)
            or isinstance(start, bool)
            or not isinstance(end, int)
            or isinstance(end, bool)
            or start < 0
            or end < start
        ):
            raise ValueError(
                f"{key} must contain valid half-open integer offsets."
            )
        return {"start": start, "end": end}

    @staticmethod
    def _probability(verification: Mapping[str, Any]) -> float:
        value = verification.get(
            "plagiarism_probability",
            verification.get("score"),
        )
        probability = PlagiarismReportBuilder._optional_probability(
            value,
            "verification.plagiarism_probability",
        )
        if probability is None:
            raise ValueError("Accepted verification has no probability.")
        return probability

    @staticmethod
    def _optional_probability(value: Any, field: str) -> float | None:
        if value is None:
            return None
        if (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(float(value))
            or not 0.0 <= float(value) <= 1.0
        ):
            raise ValueError(f"{field} must be a probability.")
        return float(value)

    @staticmethod
    def _optional_finite_number(value: Any, field: str) -> float | None:
        if value is None:
            return None
        if (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
            or not math.isfinite(float(value))
        ):
            raise ValueError(f"{field} must be a finite number.")
        return float(value)

    @staticmethod
    def _mapping_or_none(
        value: Any,
        field: str,
    ) -> dict[str, Any] | None:
        if value is None:
            return None
        if not isinstance(value, Mapping):
            raise ValueError(f"{field} must be an object or null.")
        return dict(value)

    @staticmethod
    def _final_retrieval_score(
        details: Mapping[str, Any] | None,
        candidate_keys: Sequence[str],
    ) -> float | None:
        if details is None:
            return None
        for key in candidate_keys:
            if key in details:
                return PlagiarismReportBuilder._optional_finite_number(
                    details[key],
                    f"retrieval score {key}",
                )
        return None

    @staticmethod
    def _required_string(
        record: Mapping[str, Any],
        key: str,
    ) -> str:
        value = record.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{key} must be a non-empty string.")
        return value

    @staticmethod
    def _required_integer(
        record: Mapping[str, Any],
        key: str,
    ) -> int:
        value = record.get(key)
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
            or value < 0
        ):
            raise ValueError(f"{key} must be a non-negative integer.")
        return value
