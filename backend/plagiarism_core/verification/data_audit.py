from array import array
from collections import Counter
from pathlib import Path
from typing import Any

from plagiarism_core.verification.candidate_reader import CandidateJsonReader
from plagiarism_core.verification.example_builder import (
    InvalidCandidateError,
    VerifierExampleBuilder,
)
from plagiarism_core.schemas import VerificationDataSummary


class NumericSummaryAccumulator:
    """Memory-efficient exact summaries for integer text/token lengths."""

    def __init__(self) -> None:
        self._values = array("I")

    def add(self, value: int) -> None:
        if value < 0:
            raise ValueError("Length values must be non-negative.")

        self._values.append(value)

    def to_dict(self) -> dict[str, Any]:
        if not self._values:
            return {
                "count": 0,
                "minimum": 0,
                "maximum": 0,
                "mean": 0.0,
                "p50": 0,
                "p90": 0,
                "p95": 0,
                "p99": 0,
                "over_256": 0,
                "over_512": 0,
                "over_1024": 0,
            }

        values = sorted(self._values)
        count = len(values)

        return {
            "count": count,
            "minimum": values[0],
            "maximum": values[-1],
            "mean": sum(values) / count,
            "p50": self._percentile(values, 0.50),
            "p90": self._percentile(values, 0.90),
            "p95": self._percentile(values, 0.95),
            "p99": self._percentile(values, 0.99),
            "over_256": sum(value > 256 for value in values),
            "over_512": sum(value > 512 for value in values),
            "over_1024": sum(value > 1024 for value in values),
        }

    @staticmethod
    def _percentile(values: list[int], quantile: float) -> int:
        index = round((len(values) - 1) * quantile)
        return values[index]


class VerificationDataAuditor:
    """Audit candidate labels and sizes without loading the full JSON file."""

    def __init__(
        self,
        reader: CandidateJsonReader,
        example_builder: VerifierExampleBuilder,
        tokenizer: Any | None = None,
        tokenizer_name: str | None = None,
        maximum_error_samples: int = 20,
    ) -> None:
        self.reader = reader
        self.example_builder = example_builder
        self.tokenizer = tokenizer
        self.tokenizer_name = tokenizer_name
        self.maximum_error_samples = maximum_error_samples

    def analyze(self) -> VerificationDataSummary:
        metadata = self.reader.read_metadata()

        document_count = 0
        segment_count = 0
        candidate_count = 0
        valid_example_count = 0
        invalid_candidate_count = 0
        positive_count = 0
        negative_count = 0
        documents_with_positive_candidates = 0
        segments_with_positive_candidates = 0

        retrieval_method_counts: Counter[str] = Counter()
        positive_rank_counts: Counter[str] = Counter()
        negative_rank_counts: Counter[str] = Counter()
        positive_obfuscation_counts: Counter[str] = Counter()
        positive_plagiarism_type_counts: Counter[str] = Counter()

        submitted_character_lengths = NumericSummaryAccumulator()
        source_character_lengths = NumericSummaryAccumulator()
        submitted_token_lengths = NumericSummaryAccumulator()
        source_token_lengths = NumericSummaryAccumulator()
        maximum_branch_token_lengths = NumericSummaryAccumulator()

        validation_errors: list[str] = []

        for document in self.reader.iter_documents():
            document_count += 1
            document_has_positive = False
            document_id = str(document.get("document_id", "UNKNOWN"))
            segments = document.get("segments") or []

            if not isinstance(segments, list):
                invalid_candidate_count += 1
                self._record_error(
                    validation_errors,
                    f"{document_id}: segments must be a list.",
                )
                continue

            for segment in segments:
                segment_count += 1
                segment_has_positive = False
                candidates = segment.get("candidates") or []

                if not isinstance(candidates, list):
                    invalid_candidate_count += 1
                    self._record_error(
                        validation_errors,
                        f"{document_id}: candidates must be a list.",
                    )
                    continue

                submitted_selected_text = self._selected_segment_text(segment)
                submitted_character_lengths.add(len(submitted_selected_text))

                submitted_tokens: int | None = None

                if self.tokenizer is not None:
                    submitted_tokens = self._token_length(submitted_selected_text)
                    submitted_token_lengths.add(submitted_tokens)

                for candidate in candidates:
                    candidate_count += 1

                    try:
                        example = self.example_builder.build_example(
                            document_id=document_id,
                            segment=segment,
                            candidate=candidate,
                        )
                    except (InvalidCandidateError, TypeError, ValueError) as exc:
                        invalid_candidate_count += 1
                        self._record_error(
                            validation_errors,
                            f"{document_id}: {exc}",
                        )
                        continue

                    valid_example_count += 1
                    submitted_text, source_text = (
                        self.example_builder.selected_texts(example)
                    )
                    source_character_lengths.add(len(source_text))

                    source_tokens: int | None = None

                    if self.tokenizer is not None:
                        source_tokens = self._token_length(source_text)
                        source_token_lengths.add(source_tokens)

                        if submitted_tokens is None:
                            submitted_tokens = self._token_length(submitted_text)

                        maximum_branch_token_lengths.add(
                            max(submitted_tokens, source_tokens)
                        )

                    methods = example.verification_input.retrieval.retrieval_methods
                    method_key = "+".join(sorted(methods)) if methods else "none"
                    retrieval_method_counts[method_key] += 1

                    rank_key = str(example.verification_input.retrieval.rank)

                    if example.label == 1:
                        positive_count += 1
                        segment_has_positive = True
                        document_has_positive = True
                        positive_rank_counts[rank_key] += 1

                        obfuscations = example.ground_truth.obfuscations or (
                            "unknown",
                        )
                        plagiarism_types = (
                            example.ground_truth.plagiarism_types
                            or ("unknown",)
                        )

                        positive_obfuscation_counts.update(obfuscations)
                        positive_plagiarism_type_counts.update(plagiarism_types)
                    else:
                        negative_count += 1
                        negative_rank_counts[rank_key] += 1

                if segment_has_positive:
                    segments_with_positive_candidates += 1

            if document_has_positive:
                documents_with_positive_candidates += 1

        positive_rate = (
            positive_count / valid_example_count
            if valid_example_count > 0
            else 0.0
        )

        token_fields: dict[str, Any] = {
            "tokenizer_name": self.tokenizer_name,
            "submitted_token_lengths": None,
            "source_token_lengths": None,
            "maximum_branch_token_lengths": None,
        }

        if self.tokenizer is not None:
            token_fields = {
                "tokenizer_name": self.tokenizer_name,
                "submitted_token_lengths": submitted_token_lengths.to_dict(),
                "source_token_lengths": source_token_lengths.to_dict(),
                "maximum_branch_token_lengths": (
                    maximum_branch_token_lengths.to_dict()
                ),
            }

        return VerificationDataSummary(
            candidate_file=str(Path(self.reader.candidate_path)),
            candidate_metadata=metadata,
            text_field=self.example_builder.config.text_field,
            document_count=document_count,
            segment_count=segment_count,
            candidate_count=candidate_count,
            valid_example_count=valid_example_count,
            invalid_candidate_count=invalid_candidate_count,
            positive_count=positive_count,
            negative_count=negative_count,
            positive_rate=positive_rate,
            documents_with_positive_candidates=(
                documents_with_positive_candidates
            ),
            segments_with_positive_candidates=segments_with_positive_candidates,
            retrieval_method_counts=dict(sorted(retrieval_method_counts.items())),
            positive_rank_counts=self._sorted_rank_counter(positive_rank_counts),
            negative_rank_counts=self._sorted_rank_counter(negative_rank_counts),
            positive_obfuscation_counts=dict(
                sorted(positive_obfuscation_counts.items())
            ),
            positive_plagiarism_type_counts=dict(
                sorted(positive_plagiarism_type_counts.items())
            ),
            submitted_character_lengths=submitted_character_lengths.to_dict(),
            source_character_lengths=source_character_lengths.to_dict(),
            validation_errors=tuple(validation_errors),
            **token_fields,
        )

    def _selected_segment_text(self, segment: dict[str, Any]) -> str:
        key = (
            "submitted_normalized_text"
            if self.example_builder.use_normalized_text
            else "submitted_text"
        )
        value = segment.get(key)
        return value if isinstance(value, str) else ""

    def _token_length(self, text: str) -> int:
        encoded = self.tokenizer(
            text,
            add_special_tokens=True,
            padding=False,
            truncation=False,
        )
        return len(encoded["input_ids"])

    def _record_error(self, errors: list[str], message: str) -> None:
        if len(errors) < self.maximum_error_samples:
            errors.append(message)

    @staticmethod
    def _sorted_rank_counter(counter: Counter[str]) -> dict[str, int]:
        return {
            rank: counter[rank]
            for rank in sorted(counter, key=lambda value: int(value))
        }
