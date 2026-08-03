from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping, Sequence

from plagiarism_core.reporting import (
    PlagiarismReportBuilder,
    ReportGenerationResult,
    SubmittedDocument,
)
from plagiarism_core.schemas import (
    CandidatePair,
    TextSegment,
    VerificationInput,
    VerificationResult,
)
from plagiarism_core.verification.interfaces import PairVerifier
from plagiarism_core.pipeline.candidate_adapter import (
    ProductionCandidateAdapter,
)
from plagiarism_core.pipeline.interfaces import (
    DocumentPreprocessor,
    SegmentCandidateRetriever,
)


@dataclass(frozen=True)
class PlagiarismCheckResult:
    """Small in-memory handoff suitable for a Django service layer."""

    document_id: str
    submitted_segment_count: int
    retrieved_candidate_count: int
    verified_pair_count: int
    accepted_pair_count: int
    report_result: ReportGenerationResult
    stage_metadata: Mapping[str, Any] = field(default_factory=dict)

    @property
    def report(self) -> dict[str, Any]:
        return self.report_result.to_dict()


class InMemoryPlagiarismPipeline:
    """
    Run preprocessing, retrieval, verification, and reporting in memory.

    Long-lived dependencies such as BM25, E5, and AraT5 are supplied once at
    construction and reused across calls to check_document.
    """

    def __init__(
        self,
        *,
        preprocessor: DocumentPreprocessor,
        candidate_retriever: SegmentCandidateRetriever,
        verifier: PairVerifier,
        report_builder: PlagiarismReportBuilder,
        candidate_adapter: ProductionCandidateAdapter | None = None,
    ) -> None:
        if not callable(
            getattr(preprocessor, "preprocess_text", None)
        ):
            raise TypeError(
                "preprocessor must expose preprocess_text(text, language)."
            )
        if not callable(
            getattr(candidate_retriever, "retrieve_for_segments", None)
        ):
            raise TypeError(
                "candidate_retriever must expose "
                "retrieve_for_segments(segments)."
            )
        if not callable(getattr(verifier, "verify_batch", None)):
            raise TypeError("verifier must expose verify_batch(inputs).")

        self.preprocessor = preprocessor
        self.candidate_retriever = candidate_retriever
        self.verifier = verifier
        self.report_builder = report_builder
        self.candidate_adapter = (
            candidate_adapter or ProductionCandidateAdapter()
        )

    def check_document(
        self,
        *,
        document_id: str,
        text: str,
        title: str | None = None,
        language: str = "ar",
        metadata: Mapping[str, Any] | None = None,
    ) -> PlagiarismCheckResult:
        if not document_id:
            raise ValueError("document_id cannot be empty.")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Submitted document text cannot be empty.")
        if language != "ar":
            raise ValueError(
                "The current verifier supports Arabic submissions only."
            )

        segments = list(
            self.preprocessor.preprocess_text(
                text,
                language=language,
            )
        )
        self._validate_segments(segments, document_text=text)

        candidates = list(
            self.candidate_retriever.retrieve_for_segments(segments)
        )
        candidates_by_segment = self._group_candidates(
            candidates,
            segments=segments,
        )

        verification_inputs: list[VerificationInput] = []
        for segment in segments:
            verification_inputs.extend(
                self.candidate_adapter.build_inputs(
                    document_id=document_id,
                    submitted_segment=segment,
                    candidates=candidates_by_segment[segment.segment_index],
                )
            )

        verification_results = self.verifier.verify_batch(
            verification_inputs
        )
        prediction_records = self._prediction_records(
            verification_inputs,
            verification_results,
            submitted_segment_count=len(segments),
        )
        report_result = self.report_builder.build(
            prediction_records,
            SubmittedDocument(
                document_id=document_id,
                title=title,
                language=language,
                text=text,
                character_count=len(text),
                segment_count=len(segments),
                metadata=dict(metadata or {}),
            ),
        )

        return PlagiarismCheckResult(
            document_id=document_id,
            submitted_segment_count=len(segments),
            retrieved_candidate_count=len(candidates),
            verified_pair_count=len(verification_results),
            accepted_pair_count=sum(
                int(result.is_potential_match)
                for result in verification_results
            ),
            report_result=report_result,
            stage_metadata={
                "verifier_model": self.verifier.model_name,
                "representation_language": language,
            },
        )

    @staticmethod
    def _group_candidates(
        candidates: Sequence[CandidatePair],
        *,
        segments: Sequence[TextSegment],
    ) -> dict[int, list[CandidatePair]]:
        segments_by_index = {
            segment.segment_index: segment for segment in segments
        }
        grouped = {
            segment.segment_index: [] for segment in segments
        }

        for candidate in candidates:
            if not isinstance(candidate, CandidatePair):
                raise TypeError(
                    "Candidate retrieval must return CandidatePair objects."
                )

            segment_index = candidate.submitted_segment.segment_index
            expected_segment = segments_by_index.get(segment_index)
            if expected_segment is None:
                raise ValueError(
                    "Retrieved candidate refers to an unknown submitted "
                    f"segment index: {segment_index}."
                )
            if candidate.submitted_segment != expected_segment:
                raise ValueError(
                    "Retrieved candidate does not preserve the submitted "
                    f"segment at index {segment_index}."
                )
            grouped[segment_index].append(candidate)

        return grouped

    @staticmethod
    def _validate_segments(
        segments: Sequence[TextSegment],
        *,
        document_text: str,
    ) -> None:
        previous_index: int | None = None
        for segment in segments:
            if not isinstance(segment, TextSegment):
                raise TypeError(
                    "Preprocessor.preprocess_text must return TextSegment "
                    "objects."
                )
            if previous_index is not None and (
                segment.segment_index <= previous_index
            ):
                raise ValueError(
                    "Submitted segment indices must be strictly increasing."
                )
            previous_index = segment.segment_index
            if segment.end_offset > len(document_text):
                raise ValueError(
                    "Submitted segment ends after the document text."
                )
            if (
                document_text[segment.start_offset : segment.end_offset]
                != segment.text
            ):
                raise ValueError(
                    "Preprocessing offsets do not reproduce segment text."
                )

    @staticmethod
    def _prediction_records(
        inputs: Sequence[VerificationInput],
        results: Sequence[VerificationResult],
        *,
        submitted_segment_count: int,
    ) -> list[dict[str, Any]]:
        if len(inputs) != len(results):
            raise RuntimeError(
                "Verifier returned a different number of results than inputs."
            )

        records: list[dict[str, Any]] = []
        for item, result in zip(inputs, results):
            if item.pair_id != result.pair_id:
                raise RuntimeError(
                    "Verifier result order/pair_id does not match its input."
                )
            records.append(
                {
                    "schema_version": "production_verification_prediction_v1",
                    "pair_id": item.pair_id,
                    "submitted_document_id": item.submitted_document_id,
                    "submitted_document_segment_count": (
                        submitted_segment_count
                    ),
                    "submitted_segment_index": (
                        item.submitted_segment_index
                    ),
                    "submitted_offsets": asdict(item.submitted_offsets),
                    "submitted_language": item.submitted_language,
                    "submitted_text": item.submitted_text,
                    "submitted_original_text": item.submitted_text,
                    "submitted_normalized_text": (
                        item.submitted_normalized_text
                    ),
                    "source_document_id": item.source_document_id,
                    "source_document_internal_id": (
                        item.source_document_internal_id
                    ),
                    "source_segment_id": item.source_segment_id,
                    "source_segment_index": item.source_segment_index,
                    "source_offsets": asdict(item.source_offsets),
                    "source_language": item.source_language,
                    "source_text": item.source_text,
                    "source_original_text": item.source_text,
                    "source_normalized_text": item.source_normalized_text,
                    "representation_language": (
                        item.representation_language
                    ),
                    "retrieval": asdict(item.retrieval),
                    "verification": {
                        "plagiarism_probability": (
                            result.plagiarism_probability
                        ),
                        "threshold": result.threshold,
                        "prediction": int(result.is_potential_match),
                        "checkpoint_id": result.model_version,
                        "checkpoint_epoch": result.metadata.get(
                            "checkpoint_epoch"
                        ),
                        "model_name": result.model_name,
                    },
                }
            )
        return records
