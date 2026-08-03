from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from plagiarism_core.verification.metrics import (
    BinaryVerificationMetrics,
    calculate_binary_metrics,
    select_f2_threshold,
)
from plagiarism_core.verification.training_data import SiameseBatchCollator

try:
    import torch
    from torch import nn
except ImportError:  # Keep non-neural project utilities importable.
    torch = None
    nn = None


@dataclass(frozen=True)
class ValidationInferenceResult:
    """Paths and metrics produced by one checkpoint validation pass."""

    checkpoint: str
    checkpoint_epoch: int
    validation_file: str
    predictions_file: str
    metrics_file: str
    mixed_precision: str
    metrics: BinaryVerificationMetrics

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["metrics"] = self.metrics.to_dict()
        return result


class PredictionBatchCollator(SiameseBatchCollator):
    """Tokenize a batch while retaining compact per-pair audit metadata."""

    def __call__(
        self,
        records: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        batch = super().__call__(records)
        batch["prediction_records"] = [
            self._prediction_record(record) for record in records
        ]
        return batch

    @staticmethod
    def _prediction_record(record: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "pair_id": record["pair_id"],
            "submitted_document_id": record["submitted_document_id"],
            "submitted_segment_index": record["submitted_segment_index"],
            "source_document_id": record["source_document_id"],
            "source_segment_id": record.get("source_segment_id"),
            "source_segment_index": record["source_segment_index"],
            "retrieval_rank": record.get("retrieval_rank"),
            "label": record["label"],
            "obfuscations": list(record.get("obfuscations") or []),
            "plagiarism_types": list(record.get("plagiarism_types") or []),
        }


def build_prediction_dataloader(
    dataset: Any,
    tokenizer: Any,
    *,
    batch_size: int = 8,
    max_length: int = 512,
    num_workers: int = 0,
    pin_memory: bool = False,
) -> Any:
    """Build a deterministic validation loader that preserves every pair."""
    if batch_size < 1:
        raise ValueError("batch_size must be positive.")

    try:
        from torch.utils.data import DataLoader
    except ImportError as exc:  # pragma: no cover - dependency message
        raise ImportError(
            "PyTorch is required to build the prediction data loader."
        ) from exc

    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=PredictionBatchCollator(
            tokenizer,
            max_length=max_length,
        ),
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=num_workers > 0,
    )


class VerifierValidationInference:
    """Run one frozen verifier checkpoint over the complete validation set."""

    def __init__(
        self,
        *,
        model: Any,
        validation_loader: Any,
        validation_file: str | Path,
        checkpoint_path: str | Path,
        checkpoint_payload: Mapping[str, Any],
        device: Any,
        output_directory: str | Path,
        mixed_precision: str = "auto",
        overwrite_output: bool = False,
        log_every_batches: int = 100,
    ) -> None:
        self._require_torch()

        if mixed_precision not in {"auto", "none", "fp16", "bf16"}:
            raise ValueError(
                "mixed_precision must be auto, none, fp16, or bf16."
            )
        if log_every_batches < 1:
            raise ValueError("log_every_batches must be positive.")

        self.model = model
        self.validation_loader = validation_loader
        self.validation_file = Path(validation_file)
        self.checkpoint_path = Path(checkpoint_path)
        self.checkpoint_payload = dict(checkpoint_payload)
        self.device = device
        self.output_directory = Path(output_directory)
        self.overwrite_output = overwrite_output
        self.log_every_batches = log_every_batches
        self.predictions_path = (
            self.output_directory / "validation_predictions.jsonl"
        )
        self.metrics_path = self.output_directory / "validation_metrics.json"
        self.amp_dtype = self._resolve_amp_dtype(mixed_precision)
        self.criterion = nn.BCEWithLogitsLoss()
        self._prepare_output_directory()
        self.model.to(self.device)
        self.model.eval()

    @property
    def mixed_precision_name(self) -> str:
        if self.amp_dtype is None:
            return "none"
        if self.amp_dtype == torch.float16:
            return "fp16"
        return "bf16"

    def run(self) -> ValidationInferenceResult:
        labels: list[int] = []
        scores: list[float] = []
        records: list[dict[str, Any]] = []
        seen_pair_ids: set[str] = set()
        total_loss = 0.0
        example_count = 0
        batch_count = len(self.validation_loader)

        with torch.inference_mode():
            for batch_index, batch in enumerate(
                self.validation_loader,
                start=1,
            ):
                model_inputs, batch_labels = self._move_batch(batch)

                with torch.autocast(
                    device_type=self.device.type,
                    dtype=self.amp_dtype,
                    enabled=self.amp_dtype is not None,
                ):
                    logits = self.model(**model_inputs)
                    loss = self.criterion(logits, batch_labels)

                batch_scores = [
                    float(value)
                    for value in torch.sigmoid(logits).detach().cpu().tolist()
                ]
                batch_label_values = [
                    int(value)
                    for value in batch_labels.detach().cpu().tolist()
                ]
                batch_records = batch["prediction_records"]

                if not (
                    len(batch_records)
                    == len(batch_scores)
                    == len(batch_label_values)
                ):
                    raise RuntimeError(
                        "Prediction metadata, scores, and labels are misaligned."
                    )

                batch_size = len(batch_scores)
                total_loss += float(loss.item()) * batch_size
                example_count += batch_size

                for record, label, score in zip(
                    batch_records,
                    batch_label_values,
                    batch_scores,
                ):
                    pair_id = record["pair_id"]
                    if pair_id in seen_pair_ids:
                        raise ValueError(
                            f"Duplicate validation pair_id: {pair_id!r}."
                        )
                    if record["label"] != label:
                        raise RuntimeError(
                            f"Label mismatch for validation pair {pair_id!r}."
                        )

                    seen_pair_ids.add(pair_id)
                    labels.append(label)
                    scores.append(score)
                    record["score"] = score
                    records.append(record)

                if (
                    batch_index % self.log_every_batches == 0
                    or batch_index == batch_count
                ):
                    print(
                        f"Validation inference batch {batch_index}/{batch_count} "
                        f"({example_count:,} pairs)"
                    )

        if example_count == 0:
            raise RuntimeError("Validation inference produced no predictions.")

        threshold = select_f2_threshold(labels, scores)
        metrics = calculate_binary_metrics(
            labels,
            scores,
            loss=total_loss / example_count,
            threshold=threshold,
        )

        for record in records:
            record["prediction"] = int(record["score"] >= threshold)

        self._atomic_jsonl_write(records, self.predictions_path)
        result = ValidationInferenceResult(
            checkpoint=str(self.checkpoint_path.resolve()),
            checkpoint_epoch=int(self.checkpoint_payload["global_epoch"]),
            validation_file=str(self.validation_file.resolve()),
            predictions_file=str(self.predictions_path.resolve()),
            metrics_file=str(self.metrics_path.resolve()),
            mixed_precision=self.mixed_precision_name,
            metrics=metrics,
        )
        metrics_payload = result.to_dict()
        metrics_payload["checkpoint_recorded_validation_metrics"] = (
            self.checkpoint_payload.get("validation_metrics")
        )
        metrics_payload["checkpoint_recorded_threshold"] = (
            self.checkpoint_payload.get("selected_threshold")
        )
        self._atomic_json_write(metrics_payload, self.metrics_path)
        return result

    def _move_batch(self, batch: Mapping[str, Any]) -> tuple[dict[str, Any], Any]:
        non_blocking = self.device.type == "cuda"
        model_inputs = {
            key: batch[key].to(self.device, non_blocking=non_blocking)
            for key in (
                "submitted_input_ids",
                "submitted_attention_mask",
                "source_input_ids",
                "source_attention_mask",
            )
        }
        labels = batch["labels"].to(
            self.device,
            non_blocking=non_blocking,
        )
        return model_inputs, labels

    def _resolve_amp_dtype(self, requested: str) -> Any | None:
        if self.device.type != "cuda" or requested == "none":
            return None
        if requested == "fp16":
            return torch.float16

        bf16_supported = bool(
            getattr(torch.cuda, "is_bf16_supported", lambda: False)()
        )
        if requested == "bf16":
            if not bf16_supported:
                raise ValueError(
                    "bf16 was requested, but this CUDA GPU does not support it."
                )
            return torch.bfloat16
        return torch.bfloat16 if bf16_supported else torch.float16

    def _prepare_output_directory(self) -> None:
        self.output_directory.mkdir(parents=True, exist_ok=True)
        existing = [
            path
            for path in (self.predictions_path, self.metrics_path)
            if path.exists()
        ]
        if existing and not self.overwrite_output:
            formatted = ", ".join(str(path) for path in existing)
            raise FileExistsError(
                f"Validation inference output already exists: {formatted}. "
                "Use a new output directory or explicitly enable overwrite."
            )

    @staticmethod
    def _atomic_jsonl_write(
        records: Sequence[Mapping[str, Any]],
        path: Path,
    ) -> None:
        temporary_path = path.with_suffix(path.suffix + ".tmp")
        try:
            with temporary_path.open("w", encoding="utf-8") as file:
                for record in records:
                    file.write(
                        json.dumps(record, ensure_ascii=False, separators=(",", ":"))
                    )
                    file.write("\n")
            os.replace(temporary_path, path)
        finally:
            temporary_path.unlink(missing_ok=True)

    @staticmethod
    def _atomic_json_write(payload: Mapping[str, Any], path: Path) -> None:
        temporary_path = path.with_suffix(path.suffix + ".tmp")
        try:
            with temporary_path.open("w", encoding="utf-8") as file:
                json.dump(payload, file, ensure_ascii=False, indent=2)
            os.replace(temporary_path, path)
        finally:
            temporary_path.unlink(missing_ok=True)

    @staticmethod
    def _require_torch() -> None:
        if torch is None or nn is None:
            raise ImportError(
                "PyTorch is required to run verifier validation inference."
            )