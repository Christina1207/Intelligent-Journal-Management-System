import math
from collections import Counter, defaultdict
from dataclasses import dataclass

from plagiarism_core.retrieval.lexical_features import tokenize_words
from plagiarism_core.schemas import SourceSegmentRecord


@dataclass(frozen=True)
class BM25SearchResult:
    """
    Internal BM25 result.

    This is not the final CandidatePair.
    The retriever will convert this into CandidatePair later.
    """
    source_segment: SourceSegmentRecord
    raw_score: float


class BM25Index:
    """
    In-memory BM25 index over source segments.

    This class is responsible only for:
    - indexing source segment normalized text
    - scoring source segments against a query
    - returning top-k source segments
    """

    def __init__(
        self,
        source_segments: list[SourceSegmentRecord],
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        if k1 <= 0:
            raise ValueError("k1 must be positive.")

        if not 0 <= b <= 1:
            raise ValueError("b must be between 0 and 1.")

        self.source_segments = source_segments
        self.k1 = k1
        self.b = b

        self.document_tokens: list[list[str]] = []
        self.document_term_frequencies: list[Counter[str]] = []
        self.document_lengths: list[int] = []

        self.document_frequency: dict[str, int] = {}
        self.idf: dict[str, float] = {}

        self.average_document_length = 0.0

        self._build()

    def _build(self) -> None:
        """
        Build BM25 statistics from source segments.
        """
        document_frequency_counter: defaultdict[str, int] = defaultdict(int)

        for segment in self.source_segments:
            tokens = tokenize_words(segment.normalized_text)
            term_frequency = Counter(tokens)

            self.document_tokens.append(tokens)
            self.document_term_frequencies.append(term_frequency)
            self.document_lengths.append(len(tokens))

            for term in term_frequency.keys():
                document_frequency_counter[term] += 1

        document_count = len(self.source_segments)

        if document_count == 0:
            self.average_document_length = 0.0
            self.document_frequency = {}
            self.idf = {}
            return

        self.average_document_length = (
            sum(self.document_lengths) / document_count
        )

        self.document_frequency = dict(document_frequency_counter)

        self.idf = {
            term: self._compute_idf(
                document_count=document_count,
                document_frequency=df,
            )
            for term, df in self.document_frequency.items()
        }

    def search(
        self,
        query_text: str,
        top_k: int = 10,
    ) -> list[BM25SearchResult]:
        """
        Search source segments using BM25.
        """
        if not query_text.strip() or not self.source_segments:
            return []

        query_terms = tokenize_words(query_text)

        if not query_terms:
            return []

        scored_results: list[BM25SearchResult] = []

        for document_index, source_segment in enumerate(self.source_segments):
            score = self._score_document(
                query_terms=query_terms,
                document_index=document_index,
            )

            if score <= 0:
                continue

            scored_results.append(
                BM25SearchResult(
                    source_segment=source_segment,
                    raw_score=score,
                )
            )

        scored_results.sort(
            key=lambda result: result.raw_score,
            reverse=True,
        )

        return scored_results[:top_k]

    def _score_document(
        self,
        query_terms: list[str],
        document_index: int,
    ) -> float:
        """
        Compute BM25 score for one source segment.
        """
        term_frequencies = self.document_term_frequencies[document_index]
        document_length = self.document_lengths[document_index]

        if document_length == 0 or self.average_document_length == 0:
            return 0.0

        score = 0.0

        for term in query_terms:
            if term not in term_frequencies:
                continue

            term_frequency = term_frequencies[term]
            idf = self.idf.get(term, 0.0)

            numerator = term_frequency * (self.k1 + 1)

            denominator = term_frequency + self.k1 * (
                1 - self.b + self.b * document_length / self.average_document_length
            )

            score += idf * numerator / denominator

        return score

    def _compute_idf(
        self,
        document_count: int,
        document_frequency: int,
    ) -> float:
        """
        Compute BM25 IDF.

        We use a common smoothed formula.
        """
        return math.log(
            1 + (document_count - document_frequency + 0.5)
            / (document_frequency + 0.5)
        )