from __future__ import annotations

from typing import Any, Sequence

from plagiarism_core.schemas import CandidatePair, TextSegment


class HybridCandidateRetriever:
    """
    Adapt the existing lexical, semantic, and union-merger layers.

    The existing project components are expected to expose:
    - lexical_retriever.retrieve_for_segments(list[TextSegment])
    - semantic_retriever.retrieve_for_segments(list[TextSegment])
    - candidate_merger.merge(list[list[CandidatePair]])
    """

    def __init__(
        self,
        *,
        lexical_retriever: Any,
        semantic_retriever: Any,
        candidate_merger: Any,
    ) -> None:
        self.lexical_retriever = lexical_retriever
        self.semantic_retriever = semantic_retriever
        self.candidate_merger = candidate_merger
        self._validate_component(
            lexical_retriever,
            method_name="retrieve_for_segments",
            component_name="lexical retriever",
        )
        self._validate_component(
            semantic_retriever,
            method_name="retrieve_for_segments",
            component_name="semantic retriever",
        )
        self._validate_component(
            candidate_merger,
            method_name="merge",
            component_name="candidate merger",
        )

    def retrieve_for_segments(
        self,
        submitted_segments: list[TextSegment],
    ) -> Sequence[CandidatePair]:
        if not submitted_segments:
            return []

        lexical = list(
            self.lexical_retriever.retrieve_for_segments(
                submitted_segments
            )
        )
        semantic = list(
            self.semantic_retriever.retrieve_for_segments(
                submitted_segments
            )
        )
        merged = self.candidate_merger.merge([lexical, semantic])
        if not isinstance(merged, Sequence):
            raise TypeError(
                "CandidateMerger.merge must return a candidate sequence."
            )
        return merged

    @staticmethod
    def _validate_component(
        component: Any,
        *,
        method_name: str,
        component_name: str,
    ) -> None:
        if not callable(getattr(component, method_name, None)):
            raise TypeError(
                f"The {component_name} must expose {method_name}(...)."
            )
