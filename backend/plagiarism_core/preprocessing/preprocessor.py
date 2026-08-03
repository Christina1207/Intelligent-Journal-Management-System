from typing import List

from plagiarism_core.preprocessing.language_detector import detect_language
from plagiarism_core.preprocessing.normalizer import normalize_text
from plagiarism_core.preprocessing.segmenter import PassageSegmenter
from plagiarism_core.schemas import PreprocessingConfig, TextSegment


class Preprocessor:
    """
    Shared preprocessing layer.

    Used by:
    - offline indexing
    - online checking

    This class does not write to database.
    It does not retrieve candidates.
    It does not score plagiarism.
    """

    def __init__(self, config: PreprocessingConfig | None = None) -> None:
        self.config = config or PreprocessingConfig()
        self.segmenter = PassageSegmenter(self.config)

    def preprocess_text(
        self,
        text: str,
        language: str | None = None,
    ) -> List[TextSegment]:
        """
        Convert raw text into TextSegment objects.
        """
        if text is None or not text.strip():
            return []

        document_language = language or self.config.language or detect_language(text)

        raw_spans = self.segmenter.segment(text)

        segments: List[TextSegment] = []

        for span in raw_spans:
            segment_language = self._resolve_segment_language(
                span.text,
                document_language,
            )

            normalized_text = normalize_text(
                text=span.text,
                language=segment_language,
                config=self.config,
            )

            token_count = self._count_tokens(normalized_text)

            segments.append(
                TextSegment(
                    segment_index=span.segment_index,
                    text=span.text,
                    normalized_text=normalized_text,
                    start_offset=span.start_offset,
                    end_offset=span.end_offset,
                    language=segment_language,
                    token_count=token_count,
                    char_count=len(span.text),
                )
            )

        return segments

    def _resolve_segment_language(
        self,
        segment_text: str,
        document_language: str,
    ) -> str:
        """
        Decide the language label of one segment.

        If the whole document is mixed or unknown,
        detect language per segment.
        """
        if document_language in {"ar", "en"}:
            return document_language

        return detect_language(segment_text)

    def _count_tokens(self, text: str) -> int:
        """
        Simple whitespace token count.

        We keep this simple for now.
        """
        return len(text.split())