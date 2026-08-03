from __future__ import annotations

from typing import Protocol, Sequence, runtime_checkable

from plagiarism_core.schemas import CandidatePair, TextSegment


@runtime_checkable
class DocumentPreprocessor(Protocol):
    """Stable online boundary for shared preprocessing."""

    def preprocess_text(
        self,
        text: str,
        language: str | None = None,
    ) -> Sequence[TextSegment]:
        """Normalize and segment a submitted document with exact offsets."""
        ...


@runtime_checkable
class SegmentCandidateRetriever(Protocol):
    """Return fused candidates for all submitted document segments."""

    def retrieve_for_segments(
        self,
        submitted_segments: list[TextSegment],
    ) -> Sequence[CandidatePair]:
        ...
