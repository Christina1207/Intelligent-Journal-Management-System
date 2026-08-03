from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from plagiarism_core.schemas import (
    DatasetGroundTruth,
    OffsetRange,
    RetrievalEvidence,
    VerificationExample,
    VerificationInput,
)


class InvalidCandidateError(ValueError):
    """Raised when one candidate cannot become a verification example."""


@dataclass(frozen=True)
class VerifierExampleBuilderConfig:
    """Model-independent choices for constructing verifier examples."""

    text_field: str = "original"
    representation_language: str = "ar"

    def __post_init__(self) -> None:
        if self.text_field not in {"original", "normalized"}:
            raise ValueError("text_field must be 'original' or 'normalized'.")


class VerifierExampleBuilder:
    """Convert one exported document into strict binary candidate examples."""

    def __init__(
        self,
        config: VerifierExampleBuilderConfig | None = None,
    ) -> None:
        self.config = config or VerifierExampleBuilderConfig()

    @property
    def use_normalized_text(self) -> bool:
        return self.config.text_field == "normalized"

    def iter_document_examples(
        self,
        document: dict[str, Any],
    ):
        document_id = self._required_string(document, "document_id")
        segments = document.get("segments")

        if not isinstance(segments, list):
            raise InvalidCandidateError(
                f"Document {document_id} has no valid segments list."
            )

        for segment in segments:
            candidates = segment.get("candidates", [])

            if not isinstance(candidates, list):
                raise InvalidCandidateError(
                    f"Document {document_id} contains an invalid candidates list."
                )

            for candidate in candidates:
                yield self.build_example(
                    document_id=document_id,
                    segment=segment,
                    candidate=candidate,
                )

    def build_example(
        self,
        document_id: str,
        segment: dict[str, Any],
        candidate: dict[str, Any],
    ) -> VerificationExample:
        segment_index = self._required_int(segment, "segment_index")
        submitted_offsets = self._offset_range(
            segment,
            "submitted_offsets",
        )
        source_offsets = self._offset_range(candidate, "source_offsets")

        source_segment_id = self._optional_int(candidate, "source_segment_id")
        source_segment_index = self._required_int(
            candidate,
            "source_segment_index",
        )
        source_document_id = self._required_string(
            candidate,
            "source_document_id",
        )

        pair_id = (
            f"{document_id}:submitted-{segment_index}:"
            f"source-{source_segment_id if source_segment_id is not None else source_segment_index}"
        )

        ground_truth = self._build_ground_truth(segment, candidate)
        label = self.build_binary_label(ground_truth)

        scores = candidate.get("scores") or {}

        if not isinstance(scores, dict):
            raise InvalidCandidateError(f"{pair_id} has invalid scores.")

        retrieval_methods = candidate.get("retrieval_methods") or []

        if not isinstance(retrieval_methods, list) or any(
            not isinstance(method, str) for method in retrieval_methods
        ):
            raise InvalidCandidateError(
                f"{pair_id} has invalid retrieval_methods."
            )

        retrieval = RetrievalEvidence(
            rank=self._required_int(candidate, "rank"),
            combined_ranking_score=self._required_float(
                candidate,
                "combined_ranking_score",
            ),
            retrieval_methods=tuple(retrieval_methods),
            lexical_score=self._optional_dict(scores.get("lexical")),
            semantic_score=self._optional_dict(scores.get("semantic")),
        )

        verification_input = VerificationInput(
            pair_id=pair_id,
            submitted_document_id=document_id,
            submitted_segment_index=segment_index,
            submitted_offsets=submitted_offsets,
            submitted_text=self._required_string(segment, "submitted_text"),
            submitted_normalized_text=self._required_string(
                segment,
                "submitted_normalized_text",
            ),
            submitted_language=self._required_string(segment, "language"),
            source_document_id=source_document_id,
            source_document_internal_id=self._optional_int(
                candidate,
                "source_document_internal_id",
            ),
            source_segment_id=source_segment_id,
            source_segment_index=source_segment_index,
            source_offsets=source_offsets,
            source_text=self._required_string(candidate, "source_text"),
            source_normalized_text=self._required_string(
                candidate,
                "source_normalized_text",
            ),
            source_language=self._required_string(
                candidate,
                "source_language",
            ),
            representation_language=self.config.representation_language,
            retrieval=retrieval,
        )

        return VerificationExample(
            verification_input=verification_input,
            label=label,
            ground_truth=ground_truth,
        )

    @staticmethod
    def build_binary_label(ground_truth: DatasetGroundTruth) -> int:
        """
        Apply the selected strict label without overlap-ratio filtering.

        A positive requires both the expected source document and overlap with
        the annotated source span.
        """
        return int(
            ground_truth.expected_source_document_match
            and ground_truth.expected_source_span_overlap
        )

    def selected_texts(
        self,
        example: VerificationExample,
    ) -> tuple[str, str]:
        return example.verification_input.model_texts(
            use_normalized_text=self.use_normalized_text,
        )

    def _build_ground_truth(
        self,
        segment: dict[str, Any],
        candidate: dict[str, Any],
    ) -> DatasetGroundTruth:
        payload = candidate.get("dataset_ground_truth")

        if not isinstance(payload, dict):
            raise InvalidCandidateError(
                "Candidate has no valid dataset_ground_truth object."
            )

        document_indices = self._int_tuple(
            payload.get("matching_document_annotation_indices")
        )
        span_indices = self._int_tuple(
            payload.get("matching_span_annotation_indices")
        )

        annotations = segment.get("dataset_ground_truth_annotations") or []
        annotation_by_index = {
            annotation.get("annotation_index"): annotation
            for annotation in annotations
            if isinstance(annotation, dict)
        }

        obfuscations: list[str] = []
        plagiarism_types: list[str] = []

        for annotation_index in span_indices:
            annotation = annotation_by_index.get(annotation_index)

            if annotation is None:
                continue

            obfuscation = annotation.get("obfuscation")
            plagiarism_type = annotation.get("plagiarism_type")

            if isinstance(obfuscation, str) and obfuscation:
                obfuscations.append(obfuscation)

            if isinstance(plagiarism_type, str) and plagiarism_type:
                plagiarism_types.append(plagiarism_type)

        return DatasetGroundTruth(
            expected_source_document_match=bool(
                payload.get("expected_source_document_match", False)
            ),
            expected_source_span_overlap=bool(
                payload.get("expected_source_span_overlap", False)
            ),
            matching_document_annotation_indices=document_indices,
            matching_span_annotation_indices=span_indices,
            obfuscations=tuple(obfuscations),
            plagiarism_types=tuple(plagiarism_types),
        )

    @staticmethod
    def _offset_range(payload: dict[str, Any], key: str) -> OffsetRange:
        offsets = payload.get(key)

        if not isinstance(offsets, dict):
            raise InvalidCandidateError(f"Missing or invalid {key}.")

        start = offsets.get("start")
        end = offsets.get("end")

        if not isinstance(start, int) or isinstance(start, bool):
            raise InvalidCandidateError(f"{key}.start must be an integer.")

        if not isinstance(end, int) or isinstance(end, bool):
            raise InvalidCandidateError(f"{key}.end must be an integer.")

        return OffsetRange(start=start, end=end)

    @staticmethod
    def _required_string(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)

        if not isinstance(value, str):
            raise InvalidCandidateError(f"{key} must be a string.")

        return value

    @staticmethod
    def _required_int(payload: dict[str, Any], key: str) -> int:
        value = payload.get(key)

        if not isinstance(value, int) or isinstance(value, bool):
            raise InvalidCandidateError(f"{key} must be an integer.")

        return value

    @staticmethod
    def _optional_int(payload: dict[str, Any], key: str) -> int | None:
        value = payload.get(key)

        if value is None:
            return None

        if not isinstance(value, int) or isinstance(value, bool):
            raise InvalidCandidateError(f"{key} must be an integer or null.")

        return value

    @staticmethod
    def _required_float(payload: dict[str, Any], key: str) -> float:
        value = payload.get(key)

        if not isinstance(value, (int, float, Decimal)) or isinstance(value, bool):
            raise InvalidCandidateError(f"{key} must be numeric.")

        return float(value)

    @staticmethod
    def _optional_dict(value: Any) -> dict[str, Any] | None:
        if value is None:
            return None

        if not isinstance(value, dict):
            raise InvalidCandidateError("Retrieval score must be an object or null.")

        return VerifierExampleBuilder._json_compatible(value)

    @staticmethod
    def _json_compatible(value: Any) -> Any:
        """Convert ijson Decimal values into ordinary serializable numbers."""
        if isinstance(value, Decimal):
            return float(value)

        if isinstance(value, dict):
            return {
                key: VerifierExampleBuilder._json_compatible(item)
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [
                VerifierExampleBuilder._json_compatible(item)
                for item in value
            ]

        return value

    @staticmethod
    def _int_tuple(value: Any) -> tuple[int, ...]:
        if value is None:
            return ()

        if not isinstance(value, list):
            raise InvalidCandidateError(
                "Matching annotation indices must be a list."
            )

        if any(not isinstance(item, int) or isinstance(item, bool) for item in value):
            raise InvalidCandidateError(
                "Matching annotation indices must contain integers."
            )

        return tuple(value)
