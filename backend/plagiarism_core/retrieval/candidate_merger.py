from plagiarism_core.schemas import CandidatePair


class CandidateMerger:
    """
    Merge candidate pairs coming from different retrieval branches.

    Current branches:
    - BM25 lexical retrieval
    - semantic embedding retrieval

    The merger does not score or verify plagiarism.
    It only deduplicates candidates and preserves available retrieval evidence.
    """

    def merge(
        self,
        candidate_lists: list[list[CandidatePair]],
    ) -> list[CandidatePair]:
        """
        Merge multiple candidate lists into one deduplicated candidate pool.

        Deduplication key:
            submitted_segment.segment_index + source_segment.id

        If the same pair appears in lexical and semantic retrieval,
        the merged CandidatePair keeps both lexical_score and semantic_score.
        """
        merged_by_key: dict[tuple[int, int | tuple[int, int]], CandidatePair] = {}

        for candidates in candidate_lists:
            for candidate in candidates:
                key = self._candidate_key(candidate)

                if key not in merged_by_key:
                    merged_by_key[key] = candidate
                    continue

                existing = merged_by_key[key]
                merged_by_key[key] = self._merge_two_candidates(
                    existing,
                    candidate,
                )

        return list(merged_by_key.values())

    def _candidate_key(
        self,
        candidate: CandidatePair,
    ) -> tuple[int, int | tuple[int, int]]:
        """
        Build a stable key for deduplication.

        Normally source_segment.id exists because source segments are stored
        in PostgreSQL. If id is missing, we fall back to:
            source_document_id + segment_index
        """
        submitted_index = candidate.submitted_segment.segment_index

        source_id = candidate.source_segment.id

        if source_id is not None:
            return submitted_index, source_id

        fallback_source_key = (
            candidate.source_segment.source_document_id,
            candidate.source_segment.segment_index,
        )

        return submitted_index, fallback_source_key

    def _merge_two_candidates(
        self,
        first: CandidatePair,
        second: CandidatePair,
    ) -> CandidatePair:
        """
        Merge two CandidatePair objects that refer to the same submitted/source pair.

        We preserve whichever lexical_score and semantic_score are available.
        """
        lexical_score = first.lexical_score or second.lexical_score
        semantic_score = first.semantic_score or second.semantic_score

        return CandidatePair(
            submitted_segment=first.submitted_segment,
            source_segment=first.source_segment,
            lexical_score=lexical_score,
            semantic_score=semantic_score,
        )