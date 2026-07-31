from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping

from plagiarism_core.schemas import VerificationExample
from plagiarism_core.verification.candidate_reader import CandidateJsonReader
from plagiarism_core.verification.example_builder import VerifierExampleBuilder


REPORT_READY_EXAMPLE_SCHEMA = "report_ready_verification_example_v1"


@dataclass(frozen=True)
class TestVerificationPreparationResult:
    """Counts and paths produced by the streamed test-data conversion."""

    candidate_file: str
    candidate_metadata: dict[str, Any]
    text_field: str
    examples_file: str
    manifest_file: str
    document_count: int
    document_with_candidates_count: int
    document_without_candidates_count: int
    segment_count: int
    example_count: int
    positive_count: int
    negative_count: int

    @property
    def positive_rate(self) -> float:
        if self.example_count == 0:
            return 0.0
        return self.positive_count / self.example_count

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["positive_rate"] = self.positive_rate
        result["schema_version"] = REPORT_READY_EXAMPLE_SCHEMA
        return result


class TestVerificationDataPreparer:
    """
    Stream a complete test candidate export into report-ready JSONL.

    Only one submitted document is materialized from the nested candidate JSON
    at a time. Every JSONL record remains directly consumable by the existing
    Siamese collator while preserving the offsets, texts, retrieval evidence,
    and ExAra ground truth required by later reporting and evaluation.
    """

    def __init__(
        self,
        reader: CandidateJsonReader,
        example_builder: VerifierExampleBuilder,
        *,
        expected_split: str = "test",
        expected_document_count: int | None = None,
    ) -> None:
        if not expected_split:
            raise ValueError("expected_split cannot be empty.")
        if expected_document_count is not None and expected_document_count < 1:
            raise ValueError("expected_document_count must be positive.")

        self.reader = reader
        self.example_builder = example_builder
        self.expected_split = expected_split
        self.expected_document_count = expected_document_count

    def prepare(
        self,
        output_directory: str | Path,
        *,
        overwrite: bool = False,
    ) -> TestVerificationPreparationResult:
        output_directory = Path(output_directory)
        output_directory.mkdir(parents=True, exist_ok=True)
        examples_path = output_directory / "test_verification_examples.jsonl"
        manifest_path = output_directory / "test_examples_manifest.json"
        temporary_examples_path = examples_path.with_suffix(
            examples_path.suffix + ".tmp"
        )

        self._validate_output_targets(
            (examples_path, manifest_path),
            overwrite=overwrite,
        )
        temporary_examples_path.unlink(missing_ok=True)

        metadata = self.reader.read_metadata()
        self._validate_metadata(metadata)

        document_count = 0
        document_with_candidates_count = 0
        segment_count = 0
        example_count = 0
        positive_count = 0
        seen_document_ids: set[str] = set()
        seen_pair_ids: set[str] = set()

        try:
            with temporary_examples_path.open(
                "w",
                encoding="utf-8",
            ) as output_file:
                for document in self.reader.iter_documents():
                    document_id = self._required_string(
                        document,
                        "document_id",
                    )
                    if document_id in seen_document_ids:
                        raise ValueError(
                            f"Duplicate submitted document id: {document_id!r}."
                        )
                    seen_document_ids.add(document_id)
                    document_count += 1

                    segments = document.get("segments")
                    if not isinstance(segments, list):
                        raise ValueError(
                            f"Document {document_id!r} has no valid segments."
                        )
                    segment_count += len(segments)
                    document_candidate_count = 0

                    for segment in segments:
                        candidates = segment.get("candidates", [])
                        if not isinstance(candidates, list):
                            raise ValueError(
                                f"Document {document_id!r} contains an invalid "
                                "candidates list."
                            )

                        for candidate in candidates:
                            example = self.example_builder.build_example(
                                document_id=document_id,
                                segment=segment,
                                candidate=candidate,
                            )
                            pair_id = example.verification_input.pair_id
                            if pair_id in seen_pair_ids:
                                raise ValueError(
                                    f"Duplicate verification pair_id: {pair_id!r}."
                                )
                            seen_pair_ids.add(pair_id)

                            record = self._report_ready_record(
                                document=document,
                                segment=segment,
                                candidate=candidate,
                                example=example,
                                split=str(metadata["split"]),
                            )
                            output_file.write(
                                json.dumps(
                                    record,
                                    ensure_ascii=False,
                                    separators=(",", ":"),
                                )
                            )
                            output_file.write("\n")

                            document_candidate_count += 1
                            example_count += 1
                            positive_count += example.label

                    if document_candidate_count:
                        document_with_candidates_count += 1

            if example_count == 0:
                raise ValueError(
                    "The candidate export produced no verifier examples."
                )

            self._validate_document_count(metadata, document_count)
            os.replace(temporary_examples_path, examples_path)
        except Exception:
            temporary_examples_path.unlink(missing_ok=True)
            raise

        result = TestVerificationPreparationResult(
            candidate_file=str(self.reader.candidate_path.resolve()),
            candidate_metadata=self._json_compatible(metadata),
            text_field=self.example_builder.config.text_field,
            examples_file=str(examples_path.resolve()),
            manifest_file=str(manifest_path.resolve()),
            document_count=document_count,
            document_with_candidates_count=document_with_candidates_count,
            document_without_candidates_count=(
                document_count - document_with_candidates_count
            ),
            segment_count=segment_count,
            example_count=example_count,
            positive_count=positive_count,
            negative_count=example_count - positive_count,
        )
        self._atomic_json_write(result.to_dict(), manifest_path)
        return result

    def _report_ready_record(
        self,
        *,
        document: Mapping[str, Any],
        segment: Mapping[str, Any],
        candidate: Mapping[str, Any],
        example: VerificationExample,
        split: str,
    ) -> dict[str, Any]:
        verification_input = example.verification_input
        submitted_model_text, source_model_text = (
            self.example_builder.selected_texts(example)
        )

        return {
            "schema_version": REPORT_READY_EXAMPLE_SCHEMA,
            "split": split,
            "text_field": self.example_builder.config.text_field,
            "pair_id": verification_input.pair_id,
            "submitted_document_id": (
                verification_input.submitted_document_id
            ),
            "submitted_document_segment_count": document.get(
                "submitted_segment_count"
            ),
            "submitted_segment_index": (
                verification_input.submitted_segment_index
            ),
            "submitted_offsets": asdict(
                verification_input.submitted_offsets
            ),
            "submitted_language": verification_input.submitted_language,
            "submitted_token_count": segment.get("token_count"),
            "submitted_text": submitted_model_text,
            "submitted_original_text": verification_input.submitted_text,
            "submitted_normalized_text": (
                verification_input.submitted_normalized_text
            ),
            "source_document_id": verification_input.source_document_id,
            "source_document_internal_id": (
                verification_input.source_document_internal_id
            ),
            "source_segment_id": verification_input.source_segment_id,
            "source_segment_index": (
                verification_input.source_segment_index
            ),
            "source_offsets": asdict(verification_input.source_offsets),
            "source_language": verification_input.source_language,
            "source_text": source_model_text,
            "source_original_text": verification_input.source_text,
            "source_normalized_text": (
                verification_input.source_normalized_text
            ),
            "representation_language": (
                verification_input.representation_language
            ),
            "retrieval": asdict(verification_input.retrieval),
            "label": example.label,
            "ground_truth": asdict(example.ground_truth),
            "dataset_ground_truth_annotations": self._json_compatible(
                segment.get("dataset_ground_truth_annotations") or []
            ),
            "candidate_dataset_ground_truth": self._json_compatible(
                candidate.get("dataset_ground_truth") or {}
            ),
        }

    def _validate_metadata(self, metadata: Mapping[str, Any]) -> None:
        split = metadata.get("split")
        if split != self.expected_split:
            raise ValueError(
                f"Expected candidate split {self.expected_split!r}, "
                f"got {split!r}."
            )
        if metadata.get("contains_text_snapshots") is not True:
            raise ValueError(
                "Test conversion requires contains_text_snapshots=true."
            )
        if metadata.get("contains_exara_ground_truth") is not True:
            raise ValueError(
                "Test evaluation requires contains_exara_ground_truth=true."
            )

    def _validate_document_count(
        self,
        metadata: Mapping[str, Any],
        observed_count: int,
    ) -> None:
        metadata_count = metadata.get("documents_exported")
        if metadata_count is not None and metadata_count != observed_count:
            raise ValueError(
                "Candidate metadata/document count mismatch: "
                f"{metadata_count!r} != {observed_count}."
            )
        if (
            self.expected_document_count is not None
            and observed_count != self.expected_document_count
        ):
            raise ValueError(
                f"Expected {self.expected_document_count} test documents, "
                f"found {observed_count}."
            )

    @staticmethod
    def _validate_output_targets(
        paths: tuple[Path, ...],
        *,
        overwrite: bool,
    ) -> None:
        existing = [path for path in paths if path.exists()]
        if existing and not overwrite:
            formatted = ", ".join(str(path) for path in existing)
            raise FileExistsError(
                f"Test preparation output already exists: {formatted}. "
                "Use a new output directory or explicitly enable overwrite."
            )

    @staticmethod
    def _required_string(
        payload: Mapping[str, Any],
        key: str,
    ) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{key} must be a non-empty string.")
        return value

    @staticmethod
    def _json_compatible(value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, dict):
            return {
                key: TestVerificationDataPreparer._json_compatible(item)
                for key, item in value.items()
            }
        if isinstance(value, (list, tuple)):
            return [
                TestVerificationDataPreparer._json_compatible(item)
                for item in value
            ]
        return value

    @staticmethod
    def _atomic_json_write(
        payload: Mapping[str, Any],
        path: Path,
    ) -> None:
        temporary_path = path.with_suffix(path.suffix + ".tmp")
        try:
            with temporary_path.open("w", encoding="utf-8") as file:
                json.dump(payload, file, ensure_ascii=False, indent=2)
            os.replace(temporary_path, path)
        finally:
            temporary_path.unlink(missing_ok=True)
