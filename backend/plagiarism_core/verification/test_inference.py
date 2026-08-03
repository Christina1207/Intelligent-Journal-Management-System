from __future__ import annotations

import json
import math
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from plagiarism_core.schemas import HUMAN_REVIEW_MESSAGE
from plagiarism_core.verification.metrics import (
    BinaryVerificationMetrics,
    calculate_binary_metrics,
)
from plagiarism_core.verification.training_data import SiameseBatchCollator

try:
    import torch
    from torch import nn
except ImportError:  # Keep data-only project utilities importable.
    torch = None
    nn = None


REPORT_READY_PREDICTION_SCHEMA = "report_ready_verifier_prediction_v1"
TEST_INFERENCE_MANIFEST_SCHEMA = "frozen_verifier_test_run_v1"


@dataclass(frozen=True)
class FrozenTestInferenceResult:
    """Files and pair-level metrics from one frozen test inference pass."""

    checkpoint: str
    checkpoint_id: str
    checkpoint_epoch: int
    checkpoint_recorded_threshold: float
    test_file: str
    prediction_scope: str
    pair_limit: int | None
    predictions_file: str
    metrics_file: str
    manifest_file: str
    mixed_precision: str
    resumed_pair_count: int
    metrics: BinaryVerificationMetrics

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["metrics"] = self.metrics.to_dict()
        return result


class ReportReadyPredictionBatchCollator(SiameseBatchCollator):
    """Tokenize model texts while retaining the complete rich JSONL records."""

    def __call__(
        self,
        records: Sequence[Mapping[str, Any]],
    ) -> dict[str, Any]:
        batch = super().__call__(records)
        batch["prediction_records"] = [dict(record) for record in records]
        return batch


def build_test_prediction_dataloader(
    dataset: Any,
    tokenizer: Any,
    *,
    start_index: int = 0,
    stop_index: int | None = None,
    batch_size: int = 8,
    max_length: int = 512,
    num_workers: int = 0,
    pin_memory: bool = False,
) -> Any:
    """Build a deterministic loader for a complete or resumed test pass."""
    if batch_size < 1:
        raise ValueError("batch_size must be positive.")
    if start_index < 0:
        raise ValueError("start_index cannot be negative.")

    dataset_length = len(dataset)
    resolved_stop = dataset_length if stop_index is None else stop_index
    if not start_index <= resolved_stop <= dataset_length:
        raise ValueError(
            "Expected 0 <= start_index <= stop_index <= dataset length."
        )

    try:
        from torch.utils.data import DataLoader, Subset
    except ImportError as exc:  # pragma: no cover - dependency message
        raise ImportError(
            "PyTorch is required to build the test prediction loader."
        ) from exc

    selected_dataset = Subset(
        dataset,
        range(start_index, resolved_stop),
    )
    return DataLoader(
        selected_dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=ReportReadyPredictionBatchCollator(
            tokenizer,
            max_length=max_length,
        ),
        num_workers=num_workers,
        pin_memory=pin_memory,
        persistent_workers=num_workers > 0,
    )


class FrozenVerifierTestInference:
    """
    Run a frozen verifier over report-ready test examples incrementally.

    Predictions are appended to an ``.inprogress`` JSONL file and flushed
    after every batch. A later launch can validate that prefix against the
    prepared examples and continue from the first unwritten pair.
    """

    def __init__(
        self,
        *,
        model: Any,
        dataset: Any,
        tokenizer: Any,
        test_file: str | Path,
        checkpoint_path: str | Path,
        checkpoint_payload: Mapping[str, Any],
        device: Any,
        output_directory: str | Path,
        threshold: float,
        batch_size: int = 8,
        max_length: int = 512,
        num_workers: int = 0,
        mixed_precision: str = "auto",
        pair_limit: int | None = None,
        resume: bool = False,
        overwrite_output: bool = False,
        log_every_batches: int = 100,
        fsync_every_batches: int = 25,
    ) -> None:
        self._require_torch()

        if not 0.0 <= threshold <= 1.0:
            raise ValueError("threshold must be in the interval [0, 1].")
        if batch_size < 1:
            raise ValueError("batch_size must be positive.")
        if max_length < 1:
            raise ValueError("max_length must be positive.")
        if num_workers < 0:
            raise ValueError("num_workers cannot be negative.")
        if mixed_precision not in {"auto", "none", "fp16", "bf16"}:
            raise ValueError(
                "mixed_precision must be auto, none, fp16, or bf16."
            )
        if pair_limit is not None and pair_limit < 1:
            raise ValueError("pair_limit must be positive.")
        if log_every_batches < 1:
            raise ValueError("log_every_batches must be positive.")
        if fsync_every_batches < 1:
            raise ValueError("fsync_every_batches must be positive.")

        self.model = model
        self.dataset = dataset
        self.tokenizer = tokenizer
        self.test_file = Path(test_file)
        self.checkpoint_path = Path(checkpoint_path)
        self.checkpoint_payload = dict(checkpoint_payload)
        self.device = device
        self.output_directory = Path(output_directory)
        self.threshold = float(threshold)
        self.batch_size = batch_size
        self.max_length = max_length
        self.num_workers = num_workers
        self.pair_limit = pair_limit
        self.resume = resume
        self.overwrite_output = overwrite_output
        self.log_every_batches = log_every_batches
        self.fsync_every_batches = fsync_every_batches
        self.predictions_path = (
            self.output_directory / "test_verifier_predictions.jsonl"
        )
        self.inprogress_predictions_path = self.predictions_path.with_suffix(
            self.predictions_path.suffix + ".inprogress"
        )
        self.metrics_path = (
            self.output_directory / "test_verifier_metrics.json"
        )
        self.manifest_path = (
            self.output_directory / "test_verifier_run_manifest.json"
        )
        self.checkpoint_epoch = self._checkpoint_epoch()
        self.checkpoint_id = self._checkpoint_id(self.checkpoint_path)
        self.amp_dtype = self._resolve_amp_dtype(mixed_precision)
        self.criterion = nn.BCEWithLogitsLoss(reduction="none")
        self.effective_pair_count = min(
            len(self.dataset),
            pair_limit if pair_limit is not None else len(self.dataset),
        )

        if self.effective_pair_count == 0:
            raise ValueError("The test inference dataset is empty.")

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

    @property
    def prediction_scope(self) -> str:
        if self.pair_limit is None:
            return "all_retrieved_test_candidate_pairs"
        return "limited_test_candidate_pair_smoke_test"

    def run(self) -> FrozenTestInferenceResult:
        labels, scores, total_loss, resumed_pair_count = (
            self._load_resume_prefix()
        )
        processed_pair_count = resumed_pair_count
        loader = build_test_prediction_dataloader(
            self.dataset,
            self.tokenizer,
            start_index=resumed_pair_count,
            stop_index=self.effective_pair_count,
            batch_size=self.batch_size,
            max_length=self.max_length,
            num_workers=self.num_workers,
            pin_memory=self.device.type == "cuda",
        )
        self._write_run_manifest(
            status="running",
            processed_pair_count=processed_pair_count,
            resumed_pair_count=resumed_pair_count,
        )

        mode = "a" if resumed_pair_count else "w"
        try:
            with self.inprogress_predictions_path.open(
                mode,
                encoding="utf-8",
            ) as predictions_file:
                with torch.inference_mode():
                    for batch_index, batch in enumerate(loader, start=1):
                        model_inputs, batch_labels = self._move_batch(batch)

                        with torch.autocast(
                            device_type=self.device.type,
                            dtype=self.amp_dtype,
                            enabled=self.amp_dtype is not None,
                        ):
                            logits = self.model(**model_inputs)
                            losses = self.criterion(logits, batch_labels)

                        batch_scores = [
                            float(value)
                            for value in torch.sigmoid(logits)
                            .detach()
                            .cpu()
                            .tolist()
                        ]
                        batch_losses = [
                            float(value)
                            for value in losses.detach().cpu().tolist()
                        ]
                        batch_label_values = [
                            int(value)
                            for value in batch_labels.detach().cpu().tolist()
                        ]
                        batch_records = batch["prediction_records"]

                        if not (
                            len(batch_records)
                            == len(batch_scores)
                            == len(batch_losses)
                            == len(batch_label_values)
                        ):
                            raise RuntimeError(
                                "Test metadata, scores, losses, and labels "
                                "are misaligned."
                            )

                        for record, label, score, loss in zip(
                            batch_records,
                            batch_label_values,
                            batch_scores,
                            batch_losses,
                        ):
                            if record.get("label") != label:
                                raise RuntimeError(
                                    "Prepared test label changed during "
                                    f"inference for {record.get('pair_id')!r}."
                                )

                            output_record = self._prediction_record(
                                record=record,
                                score=score,
                                loss=loss,
                            )
                            predictions_file.write(
                                json.dumps(
                                    output_record,
                                    ensure_ascii=False,
                                    separators=(",", ":"),
                                )
                            )
                            predictions_file.write("\n")
                            labels.append(label)
                            scores.append(score)
                            total_loss += loss
                            processed_pair_count += 1

                        predictions_file.flush()
                        if batch_index % self.fsync_every_batches == 0:
                            os.fsync(predictions_file.fileno())

                        if (
                            batch_index % self.log_every_batches == 0
                            or processed_pair_count
                            == self.effective_pair_count
                        ):
                            print(
                                "Test inference progress: "
                                f"{processed_pair_count:,}/"
                                f"{self.effective_pair_count:,} pairs"
                            )

                predictions_file.flush()
                os.fsync(predictions_file.fileno())
        except BaseException as exc:
            self._write_run_manifest(
                status="interrupted",
                processed_pair_count=processed_pair_count,
                resumed_pair_count=resumed_pair_count,
                error=f"{type(exc).__name__}: {exc}",
            )
            raise

        if processed_pair_count != self.effective_pair_count:
            raise RuntimeError(
                "Test inference ended before every selected pair was written: "
                f"{processed_pair_count} != {self.effective_pair_count}."
            )

        os.replace(
            self.inprogress_predictions_path,
            self.predictions_path,
        )
        metrics = calculate_binary_metrics(
            labels,
            scores,
            loss=total_loss / processed_pair_count,
            threshold=self.threshold,
        )
        result = FrozenTestInferenceResult(
            checkpoint=str(self.checkpoint_path.resolve()),
            checkpoint_id=self.checkpoint_id,
            checkpoint_epoch=self.checkpoint_epoch,
            checkpoint_recorded_threshold=self.threshold,
            test_file=str(self.test_file.resolve()),
            prediction_scope=self.prediction_scope,
            pair_limit=self.pair_limit,
            predictions_file=str(self.predictions_path.resolve()),
            metrics_file=str(self.metrics_path.resolve()),
            manifest_file=str(self.manifest_path.resolve()),
            mixed_precision=self.mixed_precision_name,
            resumed_pair_count=resumed_pair_count,
            metrics=metrics,
        )
        metrics_payload = result.to_dict()
        metrics_payload["metric_scope_note"] = (
            "These are pair-level metrics over candidates returned by "
            "retrieval. Plagiarism annotations missed completely by retrieval "
            "are not represented here and must be counted by end-to-end "
            "evaluation."
        )
        metrics_payload["threshold_source"] = (
            "frozen_validation_threshold_from_checkpoint"
        )
        metrics_payload["checkpoint_recorded_validation_metrics"] = (
            self.checkpoint_payload.get("validation_metrics")
        )
        self._atomic_json_write(metrics_payload, self.metrics_path)
        self._write_run_manifest(
            status="complete",
            processed_pair_count=processed_pair_count,
            resumed_pair_count=resumed_pair_count,
            result=result.to_dict(),
        )
        return result

    def _prediction_record(
        self,
        *,
        record: Mapping[str, Any],
        score: float,
        loss: float,
    ) -> dict[str, Any]:
        prediction = int(score >= self.threshold)
        output = dict(record)
        output["prediction_schema_version"] = (
            REPORT_READY_PREDICTION_SCHEMA
        )
        output["verification"] = {
            "plagiarism_probability": score,
            "threshold": self.threshold,
            "prediction": prediction,
            "is_potential_match": bool(prediction),
            "binary_cross_entropy_loss": loss,
            "checkpoint_id": self.checkpoint_id,
            "checkpoint_epoch": self.checkpoint_epoch,
            "model_name": self.checkpoint_payload.get(
                "encoder_model_name",
                getattr(self.model, "model_name", None),
            ),
            "mixed_precision": self.mixed_precision_name,
            "requires_human_review": bool(prediction),
            "review_message": (
                HUMAN_REVIEW_MESSAGE if prediction else None
            ),
        }
        return output

    def _load_resume_prefix(
        self,
    ) -> tuple[list[int], list[float], float, int]:
        if not self.resume or not self.inprogress_predictions_path.exists():
            return [], [], 0.0, 0

        labels: list[int] = []
        scores: list[float] = []
        total_loss = 0.0
        valid_byte_count = 0
        file_size = self.inprogress_predictions_path.stat().st_size

        with self.inprogress_predictions_path.open("rb") as file:
            line_number = 0
            while True:
                line_start = file.tell()
                raw_line = file.readline()
                if not raw_line:
                    break
                line_number += 1
                at_end = file.tell() == file_size

                if not raw_line.endswith(b"\n"):
                    if at_end:
                        break
                    raise ValueError(
                        "Resume predictions contain an incomplete line before "
                        f"the end of the file at line {line_number}."
                    )

                try:
                    record = json.loads(raw_line)
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    if at_end:
                        break
                    raise ValueError(
                        "Resume predictions contain invalid JSON at line "
                        f"{line_number}."
                    ) from exc

                index = len(labels)
                if index >= self.effective_pair_count:
                    raise ValueError(
                        "Resume predictions contain more pairs than the "
                        "selected test run."
                    )
                expected = self.dataset[index]
                self._validate_resume_record(record, expected, line_number)
                verification = record["verification"]
                labels.append(int(record["label"]))
                scores.append(float(verification["plagiarism_probability"]))
                total_loss += float(
                    verification["binary_cross_entropy_loss"]
                )
                valid_byte_count = file.tell()

                if file.tell() <= line_start:  # pragma: no cover - defensive
                    raise RuntimeError("Resume reader did not advance.")

        if valid_byte_count != file_size:
            with self.inprogress_predictions_path.open("r+b") as file:
                file.truncate(valid_byte_count)

        return labels, scores, total_loss, len(labels)

    def _validate_resume_record(
        self,
        record: Any,
        expected: Mapping[str, Any],
        line_number: int,
    ) -> None:
        if not isinstance(record, dict):
            raise ValueError(
                f"Resume prediction line {line_number} is not an object."
            )
        if record.get("pair_id") != expected.get("pair_id"):
            raise ValueError(
                "Resume prediction order does not match the prepared test "
                f"JSONL at line {line_number}."
            )
        if record.get("label") != expected.get("label"):
            raise ValueError(
                f"Resume prediction label mismatch at line {line_number}."
            )

        verification = record.get("verification")
        if not isinstance(verification, dict):
            raise ValueError(
                f"Resume prediction has no verification object at line "
                f"{line_number}."
            )
        if verification.get("checkpoint_id") != self.checkpoint_id:
            raise ValueError(
                f"Resume checkpoint mismatch at line {line_number}."
            )
        if verification.get("checkpoint_epoch") != self.checkpoint_epoch:
            raise ValueError(
                f"Resume checkpoint epoch mismatch at line {line_number}."
            )

        recorded_threshold = float(verification.get("threshold", -1.0))
        if not math.isclose(
            recorded_threshold,
            self.threshold,
            rel_tol=0.0,
            abs_tol=1e-12,
        ):
            raise ValueError(
                f"Resume threshold mismatch at line {line_number}."
            )
        for field_name in (
            "plagiarism_probability",
            "binary_cross_entropy_loss",
        ):
            try:
                value = float(verification[field_name])
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(
                    f"Resume prediction has invalid {field_name} at line "
                    f"{line_number}."
                ) from exc
            if field_name == "plagiarism_probability" and not 0.0 <= value <= 1.0:
                raise ValueError(
                    f"Resume probability is outside [0, 1] at line "
                    f"{line_number}."
                )

    def _move_batch(
        self,
        batch: Mapping[str, Any],
    ) -> tuple[dict[str, Any], Any]:
        non_blocking = self.device.type == "cuda"
        model_inputs = {
            key: batch[key].to(
                self.device,
                non_blocking=non_blocking,
            )
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
        protected_paths = (
            self.predictions_path,
            self.inprogress_predictions_path,
            self.metrics_path,
            self.manifest_path,
        )

        if self.overwrite_output:
            for path in protected_paths:
                path.unlink(missing_ok=True)
            return

        completed = [
            path
            for path in (
                self.predictions_path,
                self.metrics_path,
            )
            if path.exists()
        ]
        if completed:
            formatted = ", ".join(str(path) for path in completed)
            raise FileExistsError(
                f"Completed test inference output already exists: {formatted}."
            )
        if self.inprogress_predictions_path.exists() and not self.resume:
            raise FileExistsError(
                "An interrupted prediction file exists: "
                f"{self.inprogress_predictions_path}. Enable resume to "
                "validate it and continue."
            )
        if self.manifest_path.exists() and not self.resume:
            raise FileExistsError(
                f"A test inference manifest already exists: "
                f"{self.manifest_path}. Enable resume or select a new "
                "output directory."
            )

    def _write_run_manifest(
        self,
        *,
        status: str,
        processed_pair_count: int,
        resumed_pair_count: int,
        error: str | None = None,
        result: Mapping[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {
            "schema_version": TEST_INFERENCE_MANIFEST_SCHEMA,
            "status": status,
            "updated_at_utc": datetime.now(timezone.utc).isoformat(),
            "checkpoint": str(self.checkpoint_path.resolve()),
            "checkpoint_id": self.checkpoint_id,
            "checkpoint_epoch": self.checkpoint_epoch,
            "frozen_threshold": self.threshold,
            "threshold_source": (
                "frozen_validation_threshold_from_checkpoint"
            ),
            "test_file": str(self.test_file.resolve()),
            "dataset_pair_count": len(self.dataset),
            "selected_pair_count": self.effective_pair_count,
            "pair_limit": self.pair_limit,
            "prediction_scope": self.prediction_scope,
            "processed_pair_count": processed_pair_count,
            "resumed_pair_count": resumed_pair_count,
            "batch_size": self.batch_size,
            "maximum_tokens_per_branch": self.max_length,
            "mixed_precision": self.mixed_precision_name,
            "predictions_inprogress_file": str(
                self.inprogress_predictions_path.resolve()
            ),
            "predictions_file": str(self.predictions_path.resolve()),
            "metrics_file": str(self.metrics_path.resolve()),
        }
        if error is not None:
            payload["error"] = error
        if result is not None:
            payload["result"] = dict(result)
        self._atomic_json_write(payload, self.manifest_path)

    def _checkpoint_epoch(self) -> int:
        epoch = self.checkpoint_payload.get("global_epoch")
        if not isinstance(epoch, int) or isinstance(epoch, bool):
            raise ValueError("Checkpoint contains no valid global_epoch.")
        return epoch

    @staticmethod
    def _checkpoint_id(path: Path) -> str:
        parent_name = path.parent.name
        if parent_name:
            return f"{parent_name}/{path.name}"
        return path.name

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

    @staticmethod
    def _require_torch() -> None:
        if torch is None or nn is None:
            raise ImportError(
                "PyTorch is required to run frozen verifier test inference."
            )
