from __future__ import annotations

import hashlib
import json
import math
import os
from dataclasses import asdict, dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping

from plagiarism_core.verification.candidate_reader import CandidateJsonReader
from plagiarism_core.verification.example_builder import VerifierExampleBuilder


VALIDATION_AGGREGATION_INPUT_SCHEMA = (
    "validation_aggregation_input_v1"
)
VALIDATION_GROUND_TRUTH_SCHEMA = "validation_ground_truth_annotation_v1"
VALIDATION_ENRICHMENT_AUDIT_SCHEMA = "validation_enrichment_audit_v1"


@dataclass(frozen=True)
class ValidationEnrichmentResult:
    """Files and counts produced by the validation offset-recovery join."""

    candidate_file: str
    predictions_file: str
    validation_examples_file: str
    aggregation_input_file: str
    ground_truth_file: str
    audit_file: str
    threshold: float
    validation_document_count: int
    prediction_count: int
    resolved_pair_count: int
    ground_truth_annotation_count: int

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["schema_version"] = VALIDATION_ENRICHMENT_AUDIT_SCHEMA
        result["missing_prediction_count"] = (
            self.prediction_count - self.resolved_pair_count
        )
        return result


class ValidationPredictionEnricher:
    """
    Join compact validation predictions to the streamed candidate export.

    Prediction labels and ExAra metadata are used only for integrity checks.
    They are intentionally omitted from ``validation_aggregation_input.jsonl``
    so the aggregation algorithm cannot use ground truth.
    """

    def __init__(
        self,
        *,
        reader: CandidateJsonReader,
        predictions_path: str | Path,
        validation_examples_path: str | Path,
        threshold: float,
        expected_pair_count: int | None = None,
        example_builder: VerifierExampleBuilder | None = None,
    ) -> None:
        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be in the interval [0, 1].")
        if expected_pair_count is not None and expected_pair_count < 1:
            raise ValueError("expected_pair_count must be positive.")

        self.reader = reader
        self.predictions_path = Path(predictions_path)
        self.validation_examples_path = Path(validation_examples_path)
        self.threshold = float(threshold)
        self.expected_pair_count = expected_pair_count
        self.example_builder = example_builder or VerifierExampleBuilder()

    def enrich(
        self,
        output_directory: str | Path,
        *,
        overwrite: bool = False,
        progress_every_documents: int = 25,
    ) -> ValidationEnrichmentResult:
        if progress_every_documents < 1:
            raise ValueError("progress_every_documents must be positive.")

        output_directory = Path(output_directory)
        output_directory.mkdir(parents=True, exist_ok=True)
        aggregation_path = (
            output_directory / "validation_aggregation_input.jsonl"
        )
        ground_truth_path = (
            output_directory / "validation_ground_truth.jsonl"
        )
        audit_path = (
            output_directory / "validation_enrichment_audit.json"
        )
        targets = (aggregation_path, ground_truth_path, audit_path)
        self._validate_output_targets(targets, overwrite=overwrite)

        predictions = self._load_predictions()
        examples = self._load_validation_examples()
        self._validate_input_pair_sets(predictions, examples)
        validation_document_ids = {
            item["submitted_document_id"] for item in predictions.values()
        }

        metadata = self.reader.read_metadata()
        self._validate_candidate_metadata(metadata)

        temporary_aggregation_path = aggregation_path.with_suffix(
            aggregation_path.suffix + ".tmp"
        )
        temporary_ground_truth_path = ground_truth_path.with_suffix(
            ground_truth_path.suffix + ".tmp"
        )
        temporary_aggregation_path.unlink(missing_ok=True)
        temporary_ground_truth_path.unlink(missing_ok=True)

        resolved_pair_ids: set[str] = set()
        annotations: dict[tuple[str, str], dict[str, Any]] = {}
        scanned_document_count = 0
        selected_document_count = 0

        try:
            with temporary_aggregation_path.open(
                "w",
                encoding="utf-8",
            ) as aggregation_file:
                for document in self.reader.iter_documents():
                    scanned_document_count += 1
                    document_id = self._required_string(
                        document,
                        "document_id",
                    )
                    if document_id not in validation_document_ids:
                        continue

                    selected_document_count += 1
                    self._enrich_document(
                        document=document,
                        predictions=predictions,
                        examples=examples,
                        resolved_pair_ids=resolved_pair_ids,
                        annotations=annotations,
                        output_file=aggregation_file,
                    )

                    if (
                        selected_document_count % progress_every_documents
                        == 0
                    ):
                        print(
                            "Validation enrichment progress: "
                            f"{selected_document_count:,}/"
                            f"{len(validation_document_ids):,} documents, "
                            f"{len(resolved_pair_ids):,}/"
                            f"{len(predictions):,} pairs"
                        )

            missing_pair_ids = set(predictions) - resolved_pair_ids
            unexpected_pair_ids = resolved_pair_ids - set(predictions)
            if missing_pair_ids:
                sample = sorted(missing_pair_ids)[:5]
                raise ValueError(
                    f"{len(missing_pair_ids):,} validation predictions were "
                    f"not found in the candidate export. Sample: {sample}"
                )
            if unexpected_pair_ids:  # pragma: no cover - defensive
                raise RuntimeError(
                    "Enrichment resolved pairs that were not predictions."
                )
            if selected_document_count != len(validation_document_ids):
                raise ValueError(
                    "Candidate export does not contain every validation "
                    "document: "
                    f"{selected_document_count} != "
                    f"{len(validation_document_ids)}."
                )
            ordered_annotations = sorted(
                annotations.values(),
                key=lambda item: (
                    item["submitted_document_id"],
                    item["annotation_index"],
                    item["source_document_id"],
                ),
            )
            with temporary_ground_truth_path.open(
                "w",
                encoding="utf-8",
            ) as ground_truth_file:
                for annotation in ordered_annotations:
                    self._write_jsonl_record(
                        annotation,
                        ground_truth_file,
                    )

            os.replace(temporary_aggregation_path, aggregation_path)
            os.replace(temporary_ground_truth_path, ground_truth_path)
        except Exception:
            temporary_aggregation_path.unlink(missing_ok=True)
            temporary_ground_truth_path.unlink(missing_ok=True)
            raise

        result = ValidationEnrichmentResult(
            candidate_file=str(self.reader.candidate_path.resolve()),
            predictions_file=str(self.predictions_path.resolve()),
            validation_examples_file=str(
                self.validation_examples_path.resolve()
            ),
            aggregation_input_file=str(aggregation_path.resolve()),
            ground_truth_file=str(ground_truth_path.resolve()),
            audit_file=str(audit_path.resolve()),
            threshold=self.threshold,
            validation_document_count=len(validation_document_ids),
            prediction_count=len(predictions),
            resolved_pair_count=len(resolved_pair_ids),
            ground_truth_annotation_count=len(annotations),
        )
        audit = result.to_dict()
        audit.update(
            {
                "candidate_metadata": self._json_compatible(metadata),
                "scanned_candidate_document_count": scanned_document_count,
                "duplicate_pair_count": 0,
                "missing_example_count": 0,
                "text_mismatch_count": 0,
                "prediction_threshold_mismatch_count": 0,
                "ground_truth_fields_exposed_to_aggregation": False,
            }
        )
        self._atomic_json_write(audit, audit_path)
        return result

    def _enrich_document(
        self,
        *,
        document: Mapping[str, Any],
        predictions: Mapping[str, Mapping[str, Any]],
        examples: Mapping[str, Mapping[str, Any]],
        resolved_pair_ids: set[str],
        annotations: dict[tuple[str, str], dict[str, Any]],
        output_file: Any,
    ) -> None:
        document_id = self._required_string(document, "document_id")
        segments = document.get("segments")
        if not isinstance(segments, list):
            raise ValueError(
                f"Document {document_id!r} has no valid segments list."
            )

        for segment in segments:
            self._collect_ground_truth_annotations(
                document_id=document_id,
                segment=segment,
                annotations=annotations,
            )
            candidates = segment.get("candidates", [])
            if not isinstance(candidates, list):
                raise ValueError(
                    f"Document {document_id!r} contains invalid candidates."
                )

            for candidate in candidates:
                source_segment_id = candidate.get("source_segment_id")
                source_segment_index = candidate.get(
                    "source_segment_index"
                )
                segment_index = segment.get("segment_index")
                pair_id = (
                    f"{document_id}:submitted-{segment_index}:source-"
                    f"{source_segment_id if source_segment_id is not None else source_segment_index}"
                )
                prediction = predictions.get(pair_id)
                if prediction is None:
                    continue
                if pair_id in resolved_pair_ids:
                    raise ValueError(
                        f"Duplicate candidate pair_id: {pair_id!r}."
                    )

                example = self.example_builder.build_example(
                    document_id=document_id,
                    segment=dict(segment),
                    candidate=dict(candidate),
                )
                prepared = examples[pair_id]
                self._validate_joined_pair(
                    prediction=prediction,
                    prepared=prepared,
                    example=example,
                )
                record = self._aggregation_record(
                    example=example,
                    prediction=prediction,
                )
                self._write_jsonl_record(record, output_file)
                resolved_pair_ids.add(pair_id)

    def _aggregation_record(
        self,
        *,
        example: Any,
        prediction: Mapping[str, Any],
    ) -> dict[str, Any]:
        item = example.verification_input
        submitted_text, source_text = self.example_builder.selected_texts(
            example
        )
        return {
            "schema_version": VALIDATION_AGGREGATION_INPUT_SCHEMA,
            "pair_id": item.pair_id,
            "submitted_document_id": item.submitted_document_id,
            "submitted_segment_index": item.submitted_segment_index,
            "submitted_offsets": asdict(item.submitted_offsets),
            "submitted_language": item.submitted_language,
            "submitted_text": submitted_text,
            "submitted_original_text": item.submitted_text,
            "submitted_normalized_text": item.submitted_normalized_text,
            "source_document_id": item.source_document_id,
            "source_document_internal_id": (
                item.source_document_internal_id
            ),
            "source_segment_id": item.source_segment_id,
            "source_segment_index": item.source_segment_index,
            "source_offsets": asdict(item.source_offsets),
            "source_language": item.source_language,
            "source_text": source_text,
            "source_original_text": item.source_text,
            "source_normalized_text": item.source_normalized_text,
            "retrieval": asdict(item.retrieval),
            "verification": {
                "score": float(prediction["score"]),
                "threshold": self.threshold,
                "prediction": int(prediction["prediction"]),
            },
        }

    def _collect_ground_truth_annotations(
        self,
        *,
        document_id: str,
        segment: Mapping[str, Any],
        annotations: dict[tuple[str, str], dict[str, Any]],
    ) -> None:
        payload = segment.get("dataset_ground_truth_annotations") or []
        if not isinstance(payload, list):
            raise ValueError(
                f"Document {document_id!r} contains invalid annotations."
            )

        for position, raw_annotation in enumerate(payload):
            if not isinstance(raw_annotation, Mapping):
                raise ValueError(
                    f"Document {document_id!r} contains a non-object "
                    "annotation."
                )
            annotation = self._canonical_annotation(
                document_id=document_id,
                raw=raw_annotation,
                fallback_index=position,
            )
            key = (
                document_id,
                str(annotation["annotation_index"]),
            )
            previous = annotations.get(key)
            if previous is not None and previous != annotation:
                raise ValueError(
                    "Conflicting snapshots for annotation "
                    f"{annotation['annotation_id']!r}."
                )
            annotations[key] = annotation

    def _canonical_annotation(
        self,
        *,
        document_id: str,
        raw: Mapping[str, Any],
        fallback_index: int,
    ) -> dict[str, Any]:
        annotation_index = raw.get("annotation_index", fallback_index)
        if not isinstance(annotation_index, int) or isinstance(
            annotation_index,
            bool,
        ):
            raise ValueError("annotation_index must be an integer.")

        source_document_id = (
            raw.get("expected_source_document")
            or raw.get("source_reference")
        )
        if not isinstance(source_document_id, str) or not source_document_id:
            raise ValueError(
                "Ground-truth annotation has no source document reference."
            )

        submitted_offsets = self._annotation_offsets(
            raw,
            object_key="suspicious_offsets",
            start_key="this_offset",
            length_key="this_length",
        )
        source_offsets = self._annotation_offsets(
            raw,
            object_key="source_offsets",
            start_key="source_offset",
            length_key="source_length",
        )
        annotation_id = (
            f"{document_id}:annotation-{annotation_index}"
        )
        return {
            "schema_version": VALIDATION_GROUND_TRUTH_SCHEMA,
            "annotation_id": annotation_id,
            "annotation_index": annotation_index,
            "submitted_document_id": document_id,
            "source_document_id": source_document_id,
            "submitted_offsets": submitted_offsets,
            "source_offsets": source_offsets,
            "obfuscation": raw.get("obfuscation"),
            "plagiarism_type": (
                raw.get("plagiarism_type") or raw.get("type")
            ),
        }

    @staticmethod
    def _annotation_offsets(
        raw: Mapping[str, Any],
        *,
        object_key: str,
        start_key: str,
        length_key: str,
    ) -> dict[str, int]:
        offsets = raw.get(object_key)
        if isinstance(offsets, Mapping):
            start = offsets.get("start")
            end = offsets.get("end")
        else:
            start = raw.get(start_key)
            length = raw.get(length_key)
            end = (
                start + length
                if isinstance(start, int)
                and not isinstance(start, bool)
                and isinstance(length, int)
                and not isinstance(length, bool)
                else None
            )

        if (
            not isinstance(start, int)
            or isinstance(start, bool)
            or not isinstance(end, int)
            or isinstance(end, bool)
            or start < 0
            or end <= start
        ):
            raise ValueError(
                f"Invalid annotation offsets under {object_key!r}."
            )
        return {"start": start, "end": end}

    def _load_predictions(self) -> dict[str, dict[str, Any]]:
        records: dict[str, dict[str, Any]] = {}
        for line_number, record in self._iter_jsonl(
            self.predictions_path
        ):
            pair_id = self._required_string(record, "pair_id")
            if pair_id in records:
                raise ValueError(
                    f"Duplicate prediction pair_id {pair_id!r} at line "
                    f"{line_number}."
                )
            score = self._probability(record.get("score"), "score")
            prediction = self._binary_int(
                record.get("prediction"),
                "prediction",
            )
            expected_prediction = int(score >= self.threshold)
            if prediction != expected_prediction:
                raise ValueError(
                    f"Prediction threshold mismatch for {pair_id!r}: "
                    f"{prediction} != {expected_prediction} at threshold "
                    f"{self.threshold}."
                )

            clean = dict(record)
            clean["score"] = score
            clean["prediction"] = prediction
            self._validate_pair_metadata(clean, pair_id=pair_id)
            records[pair_id] = clean

        if not records:
            raise ValueError("Validation prediction JSONL is empty.")
        if (
            self.expected_pair_count is not None
            and len(records) != self.expected_pair_count
        ):
            raise ValueError(
                f"Expected {self.expected_pair_count:,} validation "
                f"predictions, found {len(records):,}."
            )
        return records

    def _load_validation_examples(
        self,
    ) -> dict[str, dict[str, Any]]:
        records: dict[str, dict[str, Any]] = {}
        for line_number, record in self._iter_jsonl(
            self.validation_examples_path
        ):
            pair_id = self._required_string(record, "pair_id")
            if pair_id in records:
                raise ValueError(
                    f"Duplicate validation example pair_id {pair_id!r} at "
                    f"line {line_number}."
                )
            self._validate_pair_metadata(record, pair_id=pair_id)
            records[pair_id] = {
                "submitted_document_id": record[
                    "submitted_document_id"
                ],
                "submitted_segment_index": record[
                    "submitted_segment_index"
                ],
                "source_document_id": record["source_document_id"],
                "source_segment_id": record.get("source_segment_id"),
                "source_segment_index": record["source_segment_index"],
                "retrieval_rank": record.get("retrieval_rank"),
                "label": self._binary_int(record.get("label"), "label"),
                "submitted_text_sha256": self._text_digest(
                    record.get("submitted_text"),
                    "submitted_text",
                ),
                "source_text_sha256": self._text_digest(
                    record.get("source_text"),
                    "source_text",
                ),
            }

        if not records:
            raise ValueError("Validation example JSONL is empty.")
        return records

    @staticmethod
    def _validate_input_pair_sets(
        predictions: Mapping[str, Any],
        examples: Mapping[str, Any],
    ) -> None:
        prediction_ids = set(predictions)
        example_ids = set(examples)
        if prediction_ids != example_ids:
            missing_examples = prediction_ids - example_ids
            extra_examples = example_ids - prediction_ids
            raise ValueError(
                "Prediction/example pair sets differ: "
                f"missing examples={len(missing_examples):,}, "
                f"extra examples={len(extra_examples):,}."
            )

    def _validate_joined_pair(
        self,
        *,
        prediction: Mapping[str, Any],
        prepared: Mapping[str, Any],
        example: Any,
    ) -> None:
        item = example.verification_input
        expected = {
            "submitted_document_id": item.submitted_document_id,
            "submitted_segment_index": item.submitted_segment_index,
            "source_document_id": item.source_document_id,
            "source_segment_id": item.source_segment_id,
            "source_segment_index": item.source_segment_index,
            "retrieval_rank": item.retrieval.rank,
        }
        pair_id = item.pair_id
        for field, value in expected.items():
            if prediction.get(field) != value:
                raise ValueError(
                    f"Prediction/candidate {field} mismatch for "
                    f"{pair_id!r}: {prediction.get(field)!r} != {value!r}."
                )
            if prepared.get(field) != value:
                raise ValueError(
                    f"Example/candidate {field} mismatch for {pair_id!r}: "
                    f"{prepared.get(field)!r} != {value!r}."
                )

        if prediction.get("label") != prepared["label"]:
            raise ValueError(
                f"Prediction/example label mismatch for {pair_id!r}."
            )
        if prepared["label"] != example.label:
            raise ValueError(
                f"Example/candidate label mismatch for {pair_id!r}."
            )

        submitted_text, source_text = self.example_builder.selected_texts(
            example
        )
        if (
            self._digest(submitted_text)
            != prepared["submitted_text_sha256"]
        ):
            raise ValueError(
                f"Submitted text mismatch for validation pair {pair_id!r}."
            )
        if self._digest(source_text) != prepared["source_text_sha256"]:
            raise ValueError(
                f"Source text mismatch for validation pair {pair_id!r}."
            )

    @staticmethod
    def _validate_candidate_metadata(metadata: Mapping[str, Any]) -> None:
        if metadata.get("split") != "training":
            raise ValueError(
                "Validation enrichment requires the training candidate export."
            )
        if metadata.get("contains_text_snapshots") is not True:
            raise ValueError(
                "Candidate export must contain text snapshots."
            )
        if metadata.get("contains_exara_ground_truth") is not True:
            raise ValueError(
                "Candidate export must contain ExAra ground truth."
            )

    @classmethod
    def _validate_pair_metadata(
        cls,
        record: Mapping[str, Any],
        *,
        pair_id: str,
    ) -> None:
        cls._required_string(record, "submitted_document_id")
        cls._required_int(record, "submitted_segment_index")
        cls._required_string(record, "source_document_id")
        source_segment_id = record.get("source_segment_id")
        if source_segment_id is not None:
            cls._required_int(record, "source_segment_id")
        cls._required_int(record, "source_segment_index")

        expected_pair_id = (
            f"{record['submitted_document_id']}:"
            f"submitted-{record['submitted_segment_index']}:source-"
            f"{source_segment_id if source_segment_id is not None else record['source_segment_index']}"
        )
        if pair_id != expected_pair_id:
            raise ValueError(
                f"Malformed pair_id {pair_id!r}; expected "
                f"{expected_pair_id!r}."
            )

    @staticmethod
    def _iter_jsonl(path: Path):
        if not path.is_file():
            raise FileNotFoundError(f"JSONL file does not exist: {path}")
        with path.open("r", encoding="utf-8") as file:
            for line_number, line in enumerate(file, start=1):
                if not line.strip():
                    raise ValueError(
                        f"Blank JSONL line in {path} at {line_number}."
                    )
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Invalid JSON in {path} at line {line_number}."
                    ) from exc
                if not isinstance(record, dict):
                    raise ValueError(
                        f"JSONL record in {path} at line {line_number} "
                        "is not an object."
                    )
                yield line_number, record

    @staticmethod
    def _validate_output_targets(
        paths: tuple[Path, ...],
        *,
        overwrite: bool,
    ) -> None:
        existing = [path for path in paths if path.exists()]
        if existing and not overwrite:
            names = ", ".join(str(path) for path in existing)
            raise FileExistsError(
                f"Validation enrichment outputs already exist: {names}. "
                "Choose another directory or enable overwrite."
            )

    @staticmethod
    def _required_string(
        record: Mapping[str, Any],
        key: str,
    ) -> str:
        value = record.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"{key} must be a non-empty string.")
        return value

    @staticmethod
    def _required_int(
        record: Mapping[str, Any],
        key: str,
    ) -> int:
        value = record.get(key)
        if not isinstance(value, int) or isinstance(value, bool):
            raise ValueError(f"{key} must be an integer.")
        return value

    @staticmethod
    def _binary_int(value: Any, name: str) -> int:
        if value not in {0, 1} or isinstance(value, bool):
            raise ValueError(f"{name} must be binary integer 0 or 1.")
        return int(value)

    @staticmethod
    def _probability(value: Any, name: str) -> float:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{name} must be numeric.")
        result = float(value)
        if not math.isfinite(result) or not 0.0 <= result <= 1.0:
            raise ValueError(f"{name} must be finite and within [0, 1].")
        return result

    @classmethod
    def _text_digest(cls, value: Any, name: str) -> str:
        if not isinstance(value, str):
            raise ValueError(f"{name} must be a string.")
        return cls._digest(value)

    @staticmethod
    def _digest(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    @staticmethod
    def _write_jsonl_record(record: Mapping[str, Any], file: Any) -> None:
        file.write(
            json.dumps(
                ValidationPredictionEnricher._json_compatible(record),
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )
        file.write("\n")

    @staticmethod
    def _atomic_json_write(
        payload: Mapping[str, Any],
        path: Path,
    ) -> None:
        temporary_path = path.with_suffix(path.suffix + ".tmp")
        try:
            with temporary_path.open("w", encoding="utf-8") as file:
                json.dump(
                    ValidationPredictionEnricher._json_compatible(payload),
                    file,
                    ensure_ascii=False,
                    indent=2,
                )
            os.replace(temporary_path, path)
        finally:
            temporary_path.unlink(missing_ok=True)

    @staticmethod
    def _json_compatible(value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, Mapping):
            return {
                key: ValidationPredictionEnricher._json_compatible(item)
                for key, item in value.items()
            }
        if isinstance(value, (list, tuple)):
            return [
                ValidationPredictionEnricher._json_compatible(item)
                for item in value
            ]
        return value
