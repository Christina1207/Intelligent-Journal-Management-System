from __future__ import annotations

from dataclasses import asdict
from typing import Any, Callable, Sequence

from plagiarism_core.schemas import (
    CandidatePair,
    OffsetRange,
    RetrievalEvidence,
    TextSegment,
    VerificationInput,
)


class ProductionCandidateAdapter:
    """Convert fused retrieval candidates into label-free verifier inputs."""

    def __init__(
        self,
        *,
        representation_language: str = "ar",
        supported_source_languages: frozenset[str] = frozenset({"ar"}),
        source_document_resolver: Callable[[int], Any] | None = None,
    ) -> None:
        if not representation_language:
            raise ValueError("representation_language cannot be empty.")
        if not supported_source_languages:
            raise ValueError("supported_source_languages cannot be empty.")
        self.representation_language = representation_language
        self.supported_source_languages = supported_source_languages
        self.source_document_resolver = source_document_resolver
        self._source_document_id_cache: dict[int, str] = {}

    def build_inputs(
        self,
        *,
        document_id: str,
        submitted_segment: TextSegment,
        candidates: Sequence[CandidatePair],
    ) -> list[VerificationInput]:
        if not document_id:
            raise ValueError("document_id cannot be empty.")

        results: list[VerificationInput] = []
        for rank, candidate in enumerate(candidates, start=1):
            if candidate.submitted_segment != submitted_segment:
                raise ValueError(
                    "Retrieved candidate contains a different submitted "
                    "segment than the current query."
                )

            source = candidate.source_segment
            if source.language not in self.supported_source_languages:
                raise ValueError(
                    "Current Arabic-to-Arabic verifier cannot process source "
                    f"language {source.language!r}. Add the future translation "
                    "layer before enabling this source."
                )

            source_document_id = self._source_document_id(
                source.source_document_id,
                external_id=source.source_document_external_id,
            )
            source_identity = (
                source.id
                if source.id is not None
                else f"{source_document_id}-{source.segment_index}"
            )
            pair_id = (
                f"{document_id}:submitted-{submitted_segment.segment_index}:"
                f"source-{source_identity}"
            )

            lexical = (
                asdict(candidate.lexical_score)
                if candidate.lexical_score is not None
                else None
            )
            semantic = (
                asdict(candidate.semantic_score)
                if candidate.semantic_score is not None
                else None
            )
            methods = tuple(
                dict.fromkeys(
                    item
                    for item in (
                        (
                            candidate.lexical_score.method
                            if candidate.lexical_score is not None
                            else None
                        ),
                        (
                            candidate.semantic_score.method
                            if candidate.semantic_score is not None
                            else None
                        ),
                    )
                    if item is not None
                )
            )
            combined_score = max(
                (
                    candidate.lexical_score.final_lexical_score
                    if candidate.lexical_score is not None
                    else float("-inf")
                ),
                (
                    candidate.semantic_score.final_semantic_score
                    if candidate.semantic_score is not None
                    else float("-inf")
                ),
            )
            if combined_score == float("-inf"):
                raise ValueError(
                    f"Candidate {pair_id!r} has no retrieval score."
                )

            results.append(
                VerificationInput(
                    pair_id=pair_id,
                    submitted_document_id=document_id,
                    submitted_segment_index=(
                        submitted_segment.segment_index
                    ),
                    submitted_offsets=OffsetRange(
                        start=submitted_segment.start_offset,
                        end=submitted_segment.end_offset,
                    ),
                    submitted_text=submitted_segment.text,
                    submitted_normalized_text=(
                        submitted_segment.normalized_text
                    ),
                    submitted_language=submitted_segment.language,
                    source_document_id=source_document_id,
                    source_document_internal_id=source.source_document_id,
                    source_segment_id=source.id,
                    source_segment_index=source.segment_index,
                    source_offsets=OffsetRange(
                        start=source.start_offset,
                        end=source.end_offset,
                    ),
                    source_text=source.text,
                    source_normalized_text=source.normalized_text,
                    source_language=source.language,
                    representation_language=self.representation_language,
                    retrieval=RetrievalEvidence(
                        rank=rank,
                        combined_ranking_score=float(combined_score),
                        retrieval_methods=methods,
                        lexical_score=lexical,
                        semantic_score=semantic,
                    ),
                )
            )
        return results

    def _source_document_id(
        self,
        internal_id: int,
        *,
        external_id: str | None,
    ) -> str:
        if external_id:
            return external_id
        cached = self._source_document_id_cache.get(internal_id)
        if cached is not None:
            return cached

        resolved_id = str(internal_id)
        if self.source_document_resolver is not None:
            document = self.source_document_resolver(internal_id)
            candidate_id = getattr(document, "external_id", None)
            if isinstance(candidate_id, str) and candidate_id:
                resolved_id = candidate_id
        self._source_document_id_cache[internal_id] = resolved_id
        return resolved_id
