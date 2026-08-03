from time import perf_counter

from plagiarism_core.embeddings.local_e5_embedder import (
    LocalE5Embedder,
)
from plagiarism_core.retrieval.local_semantic_index import (
    LocalSemanticIndex,
)
from plagiarism_core.schemas import (
    CandidatePair,
    SemanticScore,
    TextSegment,
)
from plagiarism_core.storage import PostgresSourceRepository


class SemanticRetriever:
    """
    Semantic candidate retrieval using multilingual-e5-base.

    Two search backends are supported:

    - local NumPy semantic index for offline evaluation
    - PostgreSQL/pgvector for production-style retrieval
    """

    def __init__(
        self,
        repository: PostgresSourceRepository | None,
        embedder: LocalE5Embedder,
        top_k: int = 10,
        min_similarity_score: float = 0.0,
        restrict_to_same_language: bool = False,
        source_type: str | None = None,
        local_index: LocalSemanticIndex | None = None,
    ) -> None:
        if repository is None and local_index is None:
            raise ValueError(
                "SemanticRetriever requires either a repository "
                "or a local semantic index."
            )

        self.repository = repository
        self.embedder = embedder
        self.top_k = top_k
        self.min_similarity_score = min_similarity_score
        self.restrict_to_same_language = (
            restrict_to_same_language
        )
        self.source_type = source_type
        self.local_index = local_index

    @property
    def backend_name(self) -> str:
        if self.local_index is not None:
            return "local_numpy"

        return "pgvector"

    def retrieve_for_segments(
        self,
        submitted_segments: list[TextSegment],
    ) -> list[CandidatePair]:
        if not submitted_segments:
            return []

        print(
            f"Embedding {len(submitted_segments)} "
            "submitted segments...",
            flush=True,
        )

        query_embeddings = self.embedder.embed_queries(
            [
                segment.normalized_text
                for segment in submitted_segments
            ],
            show_progress_bar=True,
        )

        print(
            "Finished embedding submitted segments.",
            flush=True,
        )
        print(
            f"Running semantic search using "
            f"{self.backend_name}...",
            flush=True,
        )

        all_candidates: list[CandidatePair] = []
        total_segments = len(submitted_segments)

        for query_index, (
            segment,
            query_embedding,
        ) in enumerate(
            zip(submitted_segments, query_embeddings),
            start=1,
        ):
            print(
                f"Semantic search {query_index}/{total_segments} "
                f"for segment {segment.segment_index}...",
                flush=True,
            )

            started_at = perf_counter()

            results = self._search(
                segment=segment,
                query_embedding=query_embedding,
            )

            elapsed = perf_counter() - started_at

            print(
                f"Semantic search {query_index}/{total_segments} "
                f"finished in {elapsed:.4f}s "
                f"with {len(results)} candidates.",
                flush=True,
            )

            for source_segment, similarity_score in results:
                if (
                    similarity_score
                    < self.min_similarity_score
                ):
                    continue

                semantic_score = SemanticScore(
                    method="semantic_embedding",
                    model_name=self.embedder.model_name,
                    similarity_score=similarity_score,
                    final_semantic_score=similarity_score,
                )

                all_candidates.append(
                    CandidatePair(
                        submitted_segment=segment,
                        source_segment=source_segment,
                        semantic_score=semantic_score,
                    )
                )

        print(
            "Finished semantic search.",
            flush=True,
        )

        return all_candidates

    def _search(
        self,
        segment: TextSegment,
        query_embedding: list[float],
    ) -> list:
        language_filter = self._resolve_language_filter(
            segment.language
        )

        if self.local_index is not None:
            return self.local_index.search(
                query_embedding=query_embedding,
                limit=self.top_k,
                language=language_filter,
            )

        if self.repository is None:
            raise RuntimeError(
                "PostgreSQL semantic backend has no repository."
            )

        return (
            self.repository
            .search_source_segments_by_semantic_embedding(
                query_embedding=query_embedding,
                limit=self.top_k,
                language=language_filter,
                source_type=self.source_type,
            )
        )

    def _resolve_language_filter(
        self,
        language: str,
    ) -> str | None:
        if not self.restrict_to_same_language:
            return None

        if language in {"ar", "en"}:
            return language

        return None