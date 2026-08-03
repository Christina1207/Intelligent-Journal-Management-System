from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from plagiarism_core.schemas import (
    PreparedVerificationRecord,
    VerificationDataPreparationSummary,
    VerificationExample,
    VerificationSplitSummary,
)
from plagiarism_core.verification.candidate_reader import CandidateJsonReader
from plagiarism_core.verification.example_builder import VerifierExampleBuilder


@dataclass(frozen=True)
class VerificationDataPreparationConfig:
    """Choices used to create reproducible verifier training splits."""

    validation_fraction: float = 0.20
    random_seed: int = 42
    negative_ratio: int = 3
    train_filename: str = "train_verification_examples.jsonl"
    validation_filename: str = "validation_verification_examples.jsonl"

    def __post_init__(self) -> None:
        if not 0.0 < self.validation_fraction < 1.0:
            raise ValueError("validation_fraction must be between 0 and 1.")

        if self.negative_ratio < 1:
            raise ValueError("negative_ratio must be at least 1.")

        for name in (self.train_filename, self.validation_filename):
            if not name or Path(name).name != name:
                raise ValueError("Split filenames must be non-empty base names.")


class VerificationDataPreparer:
    """
    Create compact JSONL train/validation files without pair-level leakage.

    The large candidate JSON is streamed twice. The first pass collects only
    submitted-document identifiers. The second pass writes one compact record
    per verification pair. Complete submitted documents are assigned to a
    single split, so their segments and candidates can never cross the split.
    """

    def __init__(
        self,
        reader: CandidateJsonReader,
        example_builder: VerifierExampleBuilder,
        config: VerificationDataPreparationConfig | None = None,
    ) -> None:
        self.reader = reader
        self.example_builder = example_builder
        self.config = config or VerificationDataPreparationConfig()

    def prepare(
        self,
        output_directory: str | Path,
        *,
        overwrite: bool = False,
    ) -> VerificationDataPreparationSummary:
        output_directory = Path(output_directory)
        output_directory.mkdir(parents=True, exist_ok=True)

        train_path = output_directory / self.config.train_filename
        validation_path = output_directory / self.config.validation_filename
        self._validate_output_targets(
            (train_path, validation_path),
            overwrite=overwrite,
        )

        document_ids = self._read_unique_document_ids()
        train_ids, validation_ids = self.split_document_ids(document_ids)

        train_temporary_path = train_path.with_suffix(train_path.suffix + ".tmp")
        validation_temporary_path = validation_path.with_suffix(
            validation_path.suffix + ".tmp"
        )

        self._remove_temporary_files(
            (train_temporary_path, validation_temporary_path)
        )

        train_counts = _MutableSplitCounts()
        validation_counts = _MutableSplitCounts()

        try:
            with (
                train_temporary_path.open("w", encoding="utf-8") as train_file,
                validation_temporary_path.open(
                    "w",
                    encoding="utf-8",
                ) as validation_file,
            ):
                for document in self.reader.iter_documents():
                    document_id = self._document_id(document)

                    if document_id in validation_ids:
                        destination = validation_file
                        counts = validation_counts
                    elif document_id in train_ids:
                        destination = train_file
                        counts = train_counts
                    else:  # pragma: no cover - protects against a changing file
                        raise ValueError(
                            f"Document {document_id!r} was not present during "
                            "the first candidate-file pass."
                        )

                    counts.document_ids.add(document_id)

                    for example in self.example_builder.iter_document_examples(
                        document
                    ):
                        record = self._prepared_record(example)
                        destination.write(
                            json.dumps(
                                record.to_dict(),
                                ensure_ascii=False,
                                separators=(",", ":"),
                            )
                        )
                        destination.write("\n")
                        counts.add_label(record.label)

            overlap = train_counts.document_ids & validation_counts.document_ids

            if overlap:  # pragma: no cover - defensive invariant
                raise RuntimeError(
                    "Document-level split leaked submitted documents: "
                    f"{sorted(overlap)[:5]}"
                )

            self._validate_non_empty_split("training", train_counts)
            self._validate_non_empty_split("validation", validation_counts)

            os.replace(train_temporary_path, train_path)
            os.replace(validation_temporary_path, validation_path)
        except Exception:
            self._remove_temporary_files(
                (train_temporary_path, validation_temporary_path)
            )
            raise

        return VerificationDataPreparationSummary(
            candidate_file=str(self.reader.candidate_path),
            text_field=self.example_builder.config.text_field,
            validation_fraction=self.config.validation_fraction,
            random_seed=self.config.random_seed,
            negative_ratio=self.config.negative_ratio,
            train=train_counts.to_summary(train_path),
            validation=validation_counts.to_summary(validation_path),
            document_overlap_count=0,
        )

    def split_document_ids(
        self,
        document_ids: list[str],
    ) -> tuple[frozenset[str], frozenset[str]]:
        """Return deterministic train/validation document-id sets."""
        if len(document_ids) < 2:
            raise ValueError(
                "At least two submitted documents are required for a split."
            )

        shuffled_ids = sorted(document_ids)
        random.Random(self.config.random_seed).shuffle(shuffled_ids)

        validation_count = int(
            len(shuffled_ids) * self.config.validation_fraction + 0.5
        )
        validation_count = min(
            len(shuffled_ids) - 1,
            max(1, validation_count),
        )

        validation_ids = frozenset(shuffled_ids[:validation_count])
        train_ids = frozenset(shuffled_ids[validation_count:])
        return train_ids, validation_ids

    def _read_unique_document_ids(self) -> list[str]:
        document_ids: list[str] = []
        seen: set[str] = set()

        for document in self.reader.iter_documents():
            document_id = self._document_id(document)

            if document_id in seen:
                raise ValueError(
                    f"Duplicate submitted document id: {document_id!r}."
                )

            seen.add(document_id)
            document_ids.append(document_id)

        return document_ids

    def _prepared_record(
        self,
        example: VerificationExample,
    ) -> PreparedVerificationRecord:
        verification_input = example.verification_input
        submitted_text, source_text = self.example_builder.selected_texts(example)

        return PreparedVerificationRecord(
            pair_id=verification_input.pair_id,
            submitted_document_id=verification_input.submitted_document_id,
            submitted_segment_index=(
                verification_input.submitted_segment_index
            ),
            submitted_text=submitted_text,
            source_document_id=verification_input.source_document_id,
            source_segment_id=verification_input.source_segment_id,
            source_segment_index=verification_input.source_segment_index,
            source_text=source_text,
            label=example.label,
            retrieval_rank=verification_input.retrieval.rank,
            obfuscations=example.ground_truth.obfuscations,
            plagiarism_types=example.ground_truth.plagiarism_types,
        )

    @staticmethod
    def _document_id(document: dict[str, Any]) -> str:
        document_id = document.get("document_id")

        if not isinstance(document_id, str) or not document_id:
            raise ValueError("Every submitted document needs a non-empty id.")

        return document_id

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
                f"Prepared split file already exists: {formatted}. "
                "Use overwrite=True only when replacement is intended."
            )

    @staticmethod
    def _remove_temporary_files(paths: tuple[Path, ...]) -> None:
        for path in paths:
            path.unlink(missing_ok=True)

    @staticmethod
    def _validate_non_empty_split(
        split_name: str,
        counts: _MutableSplitCounts,
    ) -> None:
        if counts.example_count == 0:
            raise ValueError(f"The {split_name} split contains no examples.")

        if counts.positive_count == 0:
            raise ValueError(
                f"The {split_name} split contains no positive examples."
            )

        if counts.negative_count == 0:
            raise ValueError(
                f"The {split_name} split contains no negative examples."
            )


@dataclass
class _MutableSplitCounts:
    document_ids: set[str] = field(default_factory=set)
    example_count: int = 0
    positive_count: int = 0
    negative_count: int = 0

    def add_label(self, label: int) -> None:
        self.example_count += 1

        if label == 1:
            self.positive_count += 1
        else:
            self.negative_count += 1

    def to_summary(self, path: Path) -> VerificationSplitSummary:
        return VerificationSplitSummary(
            file=str(path.resolve()),
            document_count=len(self.document_ids),
            example_count=self.example_count,
            positive_count=self.positive_count,
            negative_count=self.negative_count,
        )
