from plagiarism_core.retrieval.bm25_cache import BM25IndexDiskCache
from plagiarism_core.retrieval.bm25_index import BM25Index, BM25SearchResult
from plagiarism_core.retrieval.lexical_features import (
    combine_bm25_lexical_scores,
    exact_phrase_bonus,
    query_term_coverage,
    source_term_coverage,
)
from plagiarism_core.schemas import CandidatePair, LexicalScore, TextSegment
from plagiarism_core.storage import PostgresSourceRepository


class BM25LexicalRetriever:
    """
    BM25 candidate retrieval layer.

    This layer:
    - loads indexed source segments
    - builds an in-memory BM25 index
    - retrieves top source candidates for submitted segments
    - returns CandidatePair objects

    It does not decide plagiarism.
    """

    def __init__(
        self,
        repository: PostgresSourceRepository,
        candidate_pool_size: int = 50,
        final_top_k: int = 10,
        min_final_score: float = 0.05,
        k1: float = 1.5,
        b: float = 0.75,
        source_type: str | None = None,
        use_disk_cache: bool = True,
        cache_name: str = "bm25",
        cache_dir: str = "cache/bm25",
        force_rebuild_cache: bool = False,
    ) -> None:
        self.repository = repository
        self.candidate_pool_size = candidate_pool_size
        self.final_top_k = final_top_k
        self.min_final_score = min_final_score
        self.k1 = k1
        self.b = b
        self.source_type = source_type

        self.use_disk_cache = use_disk_cache
        self.force_rebuild_cache = force_rebuild_cache

        self.disk_cache = (
            BM25IndexDiskCache(
                cache_dir=cache_dir,
                cache_name=cache_name,
            )
            if use_disk_cache
            else None
        )

        self._index_cache: dict[str | None, BM25Index] = {}

    def retrieve_for_segment(
        self,
        submitted_segment: TextSegment,
    ) -> list[CandidatePair]:
        """
        Retrieve candidate source segments for one submitted segment.
        """
        language_filter = self._resolve_language_filter(submitted_segment.language)
        index = self._get_or_build_index(language_filter)

        bm25_results = index.search(
            query_text=submitted_segment.normalized_text,
            top_k=self.candidate_pool_size,
        )

        if not bm25_results:
            return []

        max_raw_score = max(result.raw_score for result in bm25_results)

        candidate_pairs: list[CandidatePair] = []

        for result in bm25_results:
            lexical_score = self._build_lexical_score(
                submitted_segment=submitted_segment,
                bm25_result=result,
                max_raw_score=max_raw_score,
            )

            if lexical_score.final_lexical_score < self.min_final_score:
                continue

            candidate_pairs.append(
                CandidatePair(
                    submitted_segment=submitted_segment,
                    source_segment=result.source_segment,
                    lexical_score=lexical_score,
                )
            )

        candidate_pairs.sort(
            key=lambda pair: pair.lexical_score.final_lexical_score,
            reverse=True,
        )

        return candidate_pairs[: self.final_top_k]

    def retrieve_for_segments(
        self,
        submitted_segments: list[TextSegment],
    ) -> list[CandidatePair]:
        """
        Retrieve candidate source segments for many submitted segments.
        """
        all_candidates: list[CandidatePair] = []

        for segment in submitted_segments:
            segment_candidates = self.retrieve_for_segment(segment)
            all_candidates.extend(segment_candidates)

        return all_candidates

    def refresh_indexes(self) -> None:
        """
        Clear cached BM25 indexes.

        Call this after indexing new source documents.
        """
        self._index_cache.clear()

    def _get_or_build_index(
        self,
        language_filter: str | None,
    ) -> BM25Index:
        """
        Build or reuse a BM25 index for a given language filter.

        Priority:
        1. In-memory cache
        2. Disk cache
        3. Build from Supabase and save to disk
        """
        memory_cache_key = language_filter or "all"

        if memory_cache_key in self._index_cache:
            return self._index_cache[memory_cache_key]

        if (
            self.disk_cache is not None
            and not self.force_rebuild_cache
        ):
            cached_index = self.disk_cache.load(
                language_filter=language_filter,
                source_type=self.source_type,
                k1=self.k1,
                b=self.b,
            )

            if cached_index is not None:
                print("Loaded BM25 index from disk cache.")
                self._index_cache[memory_cache_key] = cached_index
                return cached_index

        print("Building BM25 index from Supabase source_segments...")

        source_segments = self.repository.list_all_source_segments(
            language=language_filter,
            source_type=self.source_type,
        )

        index = BM25Index(
            source_segments=source_segments,
            k1=self.k1,
            b=self.b,
        )

        self._index_cache[memory_cache_key] = index

        if self.disk_cache is not None:
            cache_path = self.disk_cache.save(
                index=index,
                language_filter=language_filter,
                source_type=self.source_type,
                k1=self.k1,
                b=self.b,
            )

            print(f"Saved BM25 index to disk cache: {cache_path}")

        return index
    
    def _resolve_language_filter(
        self,
        language: str,
    ) -> str | None:
        """
        Decide whether to filter source segments by language.

        For Arabic submitted text, search Arabic source segments.
        For mixed or unknown text, search all source segments.
        """
        if language in {"ar", "en"}:
            return language

        return None

    def _build_lexical_score(
        self,
        submitted_segment: TextSegment,
        bm25_result: BM25SearchResult,
        max_raw_score: float,
    ) -> LexicalScore:
        """
        Build the explainable lexical score object for one candidate pair.
        """
        submitted_text = submitted_segment.normalized_text
        source_text = bm25_result.source_segment.normalized_text

        bm25_normalized_score = (
            bm25_result.raw_score / max_raw_score
            if max_raw_score > 0
            else 0.0
        )

        query_coverage = query_term_coverage(
            query_text=submitted_text,
            candidate_text=source_text,
        )

        source_coverage = source_term_coverage(
            query_text=submitted_text,
            candidate_text=source_text,
        )

        phrase_bonus = exact_phrase_bonus(
            query_text=submitted_text,
            candidate_text=source_text,
        )

        final_score = combine_bm25_lexical_scores(
            bm25_normalized_score=bm25_normalized_score,
            query_coverage=query_coverage,
            source_coverage=source_coverage,
            phrase_bonus=phrase_bonus,
        )

        return LexicalScore(
            method="bm25",
            bm25_raw_score=bm25_result.raw_score,
            bm25_normalized_score=bm25_normalized_score,
            query_term_coverage=query_coverage,
            source_term_coverage=source_coverage,
            exact_phrase_bonus=phrase_bonus,
            final_lexical_score=final_score,
            winnowing_score=None,
        )