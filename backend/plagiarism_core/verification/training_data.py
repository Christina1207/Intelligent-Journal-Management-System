from __future__ import annotations

import json
import math
import os
import random
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path
from typing import Any


class PreparedVerificationDataset:
    """
    Random-access JSONL dataset that keeps texts out of memory.

    Initialization stores only each line's byte offset and binary label. A
    worker opens its own read handle lazily, seeks to the requested record, and
    parses only that record. The object satisfies PyTorch's map-style dataset
    protocol without importing PyTorch at module-import time.
    """

    def __init__(self, jsonl_path: str | Path) -> None:
        self.jsonl_path = Path(jsonl_path)

        if not self.jsonl_path.is_file():
            raise FileNotFoundError(
                f"Prepared verifier JSONL does not exist: {self.jsonl_path}"
            )

        self._offsets: list[int] = []
        self._labels: list[int] = []
        self._positive_indices: list[int] = []
        self._negative_indices: list[int] = []
        self._file: Any | None = None
        self._file_process_id: int | None = None
        self._build_index()

        if not self._offsets:
            raise ValueError(
                f"Prepared verifier JSONL is empty: {self.jsonl_path}"
            )

    @property
    def labels(self) -> tuple[int, ...]:
        return tuple(self._labels)

    @property
    def positive_indices(self) -> tuple[int, ...]:
        return tuple(self._positive_indices)

    @property
    def negative_indices(self) -> tuple[int, ...]:
        return tuple(self._negative_indices)

    @property
    def positive_count(self) -> int:
        return len(self._positive_indices)

    @property
    def negative_count(self) -> int:
        return len(self._negative_indices)

    def __len__(self) -> int:
        return len(self._offsets)

    def __getitem__(self, index: int) -> dict[str, Any]:
        if index < 0:
            index += len(self)

        if not 0 <= index < len(self):
            raise IndexError(index)

        file = self._worker_file()
        file.seek(self._offsets[index])
        line = file.readline()

        if not line:  # pragma: no cover - protects against external mutation
            raise RuntimeError(
                f"Could not read indexed record {index} from {self.jsonl_path}."
            )

        record = json.loads(line)
        self._validate_record(record, expected_label=self._labels[index])
        return record

    def close(self) -> None:
        if self._file is not None:
            self._file.close()
            self._file = None
            self._file_process_id = None

    def __getstate__(self) -> dict[str, Any]:
        """Do not pickle an open handle into DataLoader worker processes."""
        state = self.__dict__.copy()
        state["_file"] = None
        state["_file_process_id"] = None
        return state

    def __del__(self) -> None:  # pragma: no cover - interpreter timing varies
        self.close()

    def _build_index(self) -> None:
        with self.jsonl_path.open("rb") as file:
            line_number = 0

            while True:
                offset = file.tell()
                line = file.readline()

                if not line:
                    break

                line_number += 1

                try:
                    record = json.loads(line)
                    label = record.get("label")
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise ValueError(
                        f"Invalid JSON on line {line_number} of "
                        f"{self.jsonl_path}."
                    ) from exc

                if label not in {0, 1} or isinstance(label, bool):
                    raise ValueError(
                        f"Line {line_number} has a non-binary label."
                    )

                index = len(self._offsets)
                self._offsets.append(offset)
                self._labels.append(label)

                if label == 1:
                    self._positive_indices.append(index)
                else:
                    self._negative_indices.append(index)

    def _worker_file(self):
        process_id = os.getpid()

        if self._file is None or self._file_process_id != process_id:
            self.close()
            self._file = self.jsonl_path.open("rb")
            self._file_process_id = process_id

        return self._file

    @staticmethod
    def _validate_record(
        record: Any,
        *,
        expected_label: int,
    ) -> None:
        if not isinstance(record, dict):
            raise ValueError("Prepared verifier record must be a JSON object.")

        required_strings = (
            "pair_id",
            "submitted_document_id",
            "submitted_text",
            "source_document_id",
            "source_text",
        )

        for field_name in required_strings:
            if not isinstance(record.get(field_name), str):
                raise ValueError(
                    f"Prepared verifier record has invalid {field_name}."
                )

        if record.get("label") != expected_label:
            raise RuntimeError(
                "Prepared verifier JSONL changed after it was indexed."
            )


class RotatingBalancedBatchSampler:
    """Use every positive and a rotating negative subset in each epoch."""

    def __init__(
        self,
        labels: Sequence[int],
        *,
        negative_ratio: int = 3,
        batch_size: int = 16,
        random_seed: int = 42,
    ) -> None:
        if negative_ratio < 1:
            raise ValueError("negative_ratio must be at least 1.")

        examples_per_group = negative_ratio + 1

        if batch_size < examples_per_group:
            raise ValueError(
                "batch_size must hold at least one positive/negative group."
            )

        if batch_size % examples_per_group != 0:
            raise ValueError(
                "batch_size must be divisible by negative_ratio + 1 so every "
                "batch preserves the selected class ratio."
            )

        if any(
            label not in {0, 1} or isinstance(label, bool)
            for label in labels
        ):
            raise ValueError("Sampler labels must be binary integers.")

        self.negative_ratio = negative_ratio
        self.batch_size = batch_size
        self.random_seed = random_seed
        self.positive_indices = tuple(
            index for index, label in enumerate(labels) if label == 1
        )
        negative_indices = [
            index for index, label in enumerate(labels) if label == 0
        ]

        if not self.positive_indices:
            raise ValueError("Balanced training requires positive examples.")

        required_negatives = len(self.positive_indices) * negative_ratio

        if len(negative_indices) < required_negatives:
            raise ValueError(
                "There are not enough unique negatives for the requested "
                f"1:{negative_ratio} epoch ratio."
            )

        random.Random(random_seed).shuffle(negative_indices)
        self._negative_cycle = tuple(negative_indices)
        self._required_negatives = required_negatives
        self._positives_per_batch = batch_size // examples_per_group
        self.epoch = 0

    @property
    def examples_per_epoch(self) -> int:
        return len(self.positive_indices) + self._required_negatives

    @property
    def negative_pool_size(self) -> int:
        return len(self._negative_cycle)

    @property
    def approximate_epochs_per_negative_cycle(self) -> int:
        return math.ceil(self.negative_pool_size / self._required_negatives)

    def set_epoch(self, epoch: int) -> None:
        """Choose the deterministic rotation used for one training epoch."""
        if epoch < 0:
            raise ValueError("epoch must be non-negative.")

        self.epoch = epoch

    def negative_indices_for_epoch(self, epoch: int | None = None) -> tuple[int, ...]:
        """Return the exact rotating negative subset for an epoch."""
        selected_epoch = self.epoch if epoch is None else epoch

        if selected_epoch < 0:
            raise ValueError("epoch must be non-negative.")

        start = (
            selected_epoch * self._required_negatives
        ) % self.negative_pool_size
        return tuple(
            self._negative_cycle[(start + offset) % self.negative_pool_size]
            for offset in range(self._required_negatives)
        )

    def __len__(self) -> int:
        return math.ceil(
            len(self.positive_indices) / self._positives_per_batch
        )

    def __iter__(self) -> Iterator[list[int]]:
        positives = list(self.positive_indices)
        negatives = list(self.negative_indices_for_epoch())

        positive_random = random.Random(self.random_seed + 104729 * self.epoch)
        negative_random = random.Random(self.random_seed + 130363 * self.epoch)
        positive_random.shuffle(positives)
        negative_random.shuffle(negatives)

        negative_cursor = 0

        for start in range(0, len(positives), self._positives_per_batch):
            positive_batch = positives[
                start : start + self._positives_per_batch
            ]
            negative_count = len(positive_batch) * self.negative_ratio
            negative_batch = negatives[
                negative_cursor : negative_cursor + negative_count
            ]
            negative_cursor += negative_count

            batch = positive_batch + negative_batch
            batch_random = random.Random(
                self.random_seed + 15485863 * self.epoch + start
            )
            batch_random.shuffle(batch)
            yield batch


class SiameseBatchCollator:
    """Tokenize the submitted and source branches independently."""

    def __init__(self, tokenizer: Any, *, max_length: int = 512) -> None:
        if max_length < 1:
            raise ValueError("max_length must be positive.")

        self.tokenizer = tokenizer
        self.max_length = max_length

    def __call__(
        self,
        records: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        if not records:
            raise ValueError("Cannot collate an empty verifier batch.")

        submitted_texts = [
            self._text(record, "submitted_text") for record in records
        ]
        source_texts = [self._text(record, "source_text") for record in records]
        labels = [self._label(record) for record in records]

        submitted_tokens = self._tokenize(submitted_texts)
        source_tokens = self._tokenize(source_texts)

        try:
            import torch
        except ImportError as exc:  # pragma: no cover - dependency message
            raise ImportError(
                "PyTorch is required to collate verifier training batches."
            ) from exc

        return {
            "submitted_input_ids": submitted_tokens["input_ids"],
            "submitted_attention_mask": submitted_tokens["attention_mask"],
            "source_input_ids": source_tokens["input_ids"],
            "source_attention_mask": source_tokens["attention_mask"],
            "labels": torch.tensor(labels, dtype=torch.float32),
            "pair_ids": [record["pair_id"] for record in records],
            "submitted_document_ids": [
                record["submitted_document_id"] for record in records
            ],
            "source_document_ids": [
                record["source_document_id"] for record in records
            ],
            "retrieval_ranks": [
                record.get("retrieval_rank") for record in records
            ],
        }

    def _tokenize(self, texts: list[str]) -> Mapping[str, Any]:
        tokens = self.tokenizer(
            texts,
            add_special_tokens=True,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )

        if "input_ids" not in tokens or "attention_mask" not in tokens:
            raise ValueError(
                "Tokenizer output needs input_ids and attention_mask."
            )

        return tokens

    @staticmethod
    def _text(record: Mapping[str, Any], key: str) -> str:
        value = record.get(key)

        if not isinstance(value, str):
            raise ValueError(f"Prepared record has invalid {key}.")

        return value

    @staticmethod
    def _label(record: Mapping[str, Any]) -> int:
        label = record.get("label")

        if label not in {0, 1} or isinstance(label, bool):
            raise ValueError("Prepared record has a non-binary label.")

        return label


def build_training_dataloader(
    dataset: PreparedVerificationDataset,
    tokenizer: Any,
    *,
    negative_ratio: int = 3,
    batch_size: int = 16,
    max_length: int = 512,
    random_seed: int = 42,
    num_workers: int = 0,
    pin_memory: bool = False,
):
    """Build the balanced training loader and return it with its sampler."""
    try:
        from torch.utils.data import DataLoader
    except ImportError as exc:  # pragma: no cover - dependency message
        raise ImportError(
            "PyTorch is required to build verifier data loaders."
        ) from exc

    batch_sampler = RotatingBalancedBatchSampler(
        dataset.labels,
        negative_ratio=negative_ratio,
        batch_size=batch_size,
        random_seed=random_seed,
    )
    loader = DataLoader(
        dataset,
        batch_sampler=batch_sampler,
        collate_fn=SiameseBatchCollator(tokenizer, max_length=max_length),
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=num_workers > 0,
    )
    return loader, batch_sampler


def build_validation_dataloader(
    dataset: PreparedVerificationDataset,
    tokenizer: Any,
    *,
    batch_size: int = 16,
    max_length: int = 512,
    num_workers: int = 0,
    pin_memory: bool = False,
):
    """Build a sequential loader that preserves natural validation balance."""
    try:
        from torch.utils.data import DataLoader
    except ImportError as exc:  # pragma: no cover - dependency message
        raise ImportError(
            "PyTorch is required to build verifier data loaders."
        ) from exc

    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=SiameseBatchCollator(tokenizer, max_length=max_length),
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=num_workers > 0,
    )
