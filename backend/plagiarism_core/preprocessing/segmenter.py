import re
from typing import List

from plagiarism_core.schemas import PreprocessingConfig, TextSpan


SENTENCE_END_PATTERN = re.compile(r"(?<=[.!؟?؛;])\s+")


class PassageSegmenter:
    """
    Segment raw document text into passages with offsets.

    Strategy:
    1. Extract paragraph spans.
    2. If paragraph is acceptable length, keep it.
    3. If paragraph is too long, split it into sentence groups.
    4. If sentence grouping is still too long, use word sliding windows.
    5. Merge very small neighboring passages.
    """

    def __init__(self, config: PreprocessingConfig | None = None) -> None:
        self.config = config or PreprocessingConfig()

    def segment(self, text: str) -> List[TextSpan]:
        if text is None or not text.strip():
            return []

        paragraph_spans = self._extract_paragraph_spans(text)

        if not paragraph_spans:
            paragraph_spans = [(0, len(text))]

        rough_spans: List[tuple[int, int]] = []

        for start_offset, end_offset in paragraph_spans:
            length = end_offset - start_offset

            if length <= self.config.max_segment_chars:
                rough_spans.append((start_offset, end_offset))
                continue

            sentence_group_spans = self._split_long_span_by_sentences(
                text=text,
                start_offset=start_offset,
                end_offset=end_offset,
            )

            rough_spans.extend(sentence_group_spans)

        merged_spans = self._merge_small_spans(text, rough_spans)

        final_spans: List[tuple[int, int]] = []

        for start_offset, end_offset in merged_spans:
            length = end_offset - start_offset

            if length <= self.config.max_segment_chars:
                final_spans.append((start_offset, end_offset))
            else:
                final_spans.extend(
                    self._sliding_window_segment(
                        text=text,
                        start_offset=start_offset,
                        end_offset=end_offset,
                    )
                )

        return self._build_text_spans(text, final_spans)

    def _extract_paragraph_spans(self, text: str) -> List[tuple[int, int]]:
        """
        Extract paragraphs separated by blank lines.

        Offsets are preserved.
        """
        spans: List[tuple[int, int]] = []

        pattern = re.compile(r"\S[\s\S]*?(?=\n\s*\n|\Z)")

        for match in pattern.finditer(text):
            start, end = self._trim_offsets(text, match.start(), match.end())

            if start < end:
                spans.append((start, end))

        return spans

    def _split_long_span_by_sentences(
        self,
        text: str,
        start_offset: int,
        end_offset: int,
    ) -> List[tuple[int, int]]:
        """
        Split a long paragraph into sentence groups.

        If sentence detection fails, return the original span;
        sliding-window fallback will handle it later.
        """
        paragraph = text[start_offset:end_offset]

        sentence_spans = self._extract_sentence_spans(paragraph, base_offset=start_offset)

        if len(sentence_spans) <= 1:
            return [(start_offset, end_offset)]

        grouped: List[tuple[int, int]] = []

        current_start = sentence_spans[0][0]
        current_end = sentence_spans[0][1]

        for next_start, next_end in sentence_spans[1:]:
            candidate_length = next_end - current_start

            if candidate_length <= self.config.target_segment_chars:
                current_end = next_end
            else:
                grouped.append((current_start, current_end))
                current_start = next_start
                current_end = next_end

        grouped.append((current_start, current_end))

        return grouped

    def _extract_sentence_spans(
        self,
        text: str,
        base_offset: int,
    ) -> List[tuple[int, int]]:
        """
        Sentence segmentation using punctuation boundaries.

        This is not a full Arabic sentence tokenizer,
        but it is good enough for a practical v1.
        """
        spans: List[tuple[int, int]] = []

        current_start = 0

        for match in SENTENCE_END_PATTERN.finditer(text):
            local_end = match.start() + 1
            clean_start, clean_end = self._trim_offsets(
                text,
                current_start,
                local_end,
            )

            if clean_start < clean_end:
                spans.append((base_offset + clean_start, base_offset + clean_end))

            current_start = match.end()

        clean_start, clean_end = self._trim_offsets(text, current_start, len(text))

        if clean_start < clean_end:
            spans.append((base_offset + clean_start, base_offset + clean_end))

        return spans

    def _merge_small_spans(
        self,
        text: str,
        spans: List[tuple[int, int]],
    ) -> List[tuple[int, int]]:
        """
        Merge small neighboring spans so we do not produce useless tiny passages.
        """
        if not spans:
            return []

        merged: List[tuple[int, int]] = []

        current_start, current_end = spans[0]

        for next_start, next_end in spans[1:]:
            current_length = current_end - current_start
            candidate_length = next_end - current_start

            should_merge = (
                current_length < self.config.min_segment_chars
                and candidate_length <= self.config.max_segment_chars
            )

            if should_merge:
                current_end = next_end
            else:
                merged.append((current_start, current_end))
                current_start, current_end = next_start, next_end

        merged.append((current_start, current_end))

        return merged

    def _sliding_window_segment(
        self,
        text: str,
        start_offset: int,
        end_offset: int,
    ) -> List[tuple[int, int]]:
        """
        Split a very long span using word windows.

        Used as fallback when paragraph/sentence splitting is not enough.
        """
        passage = text[start_offset:end_offset]
        word_matches = list(re.finditer(r"\S+", passage))

        if not word_matches:
            return []

        if len(word_matches) <= self.config.sliding_window_words:
            return [(start_offset, end_offset)]

        spans: List[tuple[int, int]] = []
        word_start_index = 0

        while word_start_index < len(word_matches):
            word_end_index = min(
                word_start_index + self.config.sliding_window_words,
                len(word_matches),
            )

            first_word = word_matches[word_start_index]
            last_word = word_matches[word_end_index - 1]

            absolute_start = start_offset + first_word.start()
            absolute_end = start_offset + last_word.end()

            spans.append((absolute_start, absolute_end))

            if word_end_index == len(word_matches):
                break

            word_start_index += self.config.sliding_window_stride

        return spans

    def _build_text_spans(
        self,
        text: str,
        spans: List[tuple[int, int]],
    ) -> List[TextSpan]:
        text_spans: List[TextSpan] = []

        for index, (start_offset, end_offset) in enumerate(spans):
            clean_start, clean_end = self._trim_offsets(text, start_offset, end_offset)

            if clean_start >= clean_end:
                continue

            text_spans.append(
                TextSpan(
                    segment_index=len(text_spans),
                    text=text[clean_start:clean_end],
                    start_offset=clean_start,
                    end_offset=clean_end,
                )
            )

        return text_spans

    def _trim_offsets(
        self,
        text: str,
        start_offset: int,
        end_offset: int,
    ) -> tuple[int, int]:
        """
        Trim whitespace while keeping offsets correct.
        """
        while start_offset < end_offset and text[start_offset].isspace():
            start_offset += 1

        while end_offset > start_offset and text[end_offset - 1].isspace():
            end_offset -= 1

        return start_offset, end_offset