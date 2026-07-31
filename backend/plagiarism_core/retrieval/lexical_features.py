import re


TOKEN_PATTERN = re.compile(r"\S+")


def tokenize_words(text: str) -> list[str]:
    """
    Simple whitespace tokenization over normalized text.

    We use normalized_text from preprocessing, so this is enough for BM25 v1.
    """
    if not text:
        return []

    return TOKEN_PATTERN.findall(text)


def unique_terms(text: str) -> set[str]:
    """
    Return unique terms from text.
    """
    return set(tokenize_words(text))


def query_term_coverage(query_text: str, candidate_text: str) -> float:
    """
    Measures how much of the submitted/query segment appears in the source segment.

    This is useful because the submitted segment may be shorter than the source segment.
    """
    query_terms = unique_terms(query_text)
    candidate_terms = unique_terms(candidate_text)

    if not query_terms or not candidate_terms:
        return 0.0

    return len(query_terms.intersection(candidate_terms)) / len(query_terms)


def source_term_coverage(query_text: str, candidate_text: str) -> float:
    """
    Measures how much of the source segment is covered by the submitted/query segment.

    This is usually lower when the source segment is longer.
    """
    query_terms = unique_terms(query_text)
    candidate_terms = unique_terms(candidate_text)

    if not query_terms or not candidate_terms:
        return 0.0

    return len(query_terms.intersection(candidate_terms)) / len(candidate_terms)


def exact_phrase_bonus(query_text: str, candidate_text: str) -> float:
    """
    Returns 1.0 when one normalized text contains the other.

    This is a simple high-confidence lexical signal.
    """
    query = query_text.strip()
    candidate = candidate_text.strip()

    if not query or not candidate:
        return 0.0

    if query in candidate or candidate in query:
        return 1.0

    return 0.0


def combine_bm25_lexical_scores(
    bm25_normalized_score: float,
    query_coverage: float,
    source_coverage: float,
    phrase_bonus: float,
) -> float:
    """
    Combine BM25 and lexical overlap signals into one retrieval score.

    We use max because retrieval should prioritize recall.
    If any signal is strong, the candidate should survive for verification.
    """
    return max(
        bm25_normalized_score,
        query_coverage,
        source_coverage,
        phrase_bonus,
    )