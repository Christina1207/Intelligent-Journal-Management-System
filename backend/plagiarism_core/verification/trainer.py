from __future__ import annotations

import json
import math
import os
import random
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from plagiarism_core.verification.metrics import (
    BinaryVerificationMetrics,
    calculate_binary_metrics,
    select_f2_threshold,
)

try:
    import torch
    from torch import nn
except ImportError:  # Keep non-neural project utilities importable.
    torch = None
    nn = None


@dataclass(frozen=True)
class O1TrainingConfig:
    """Selected stable O1 optimization recipe."""

    classifier_warmup_epochs: int = 1
    maximum_joint_epochs: int = 5
    classifier_learning_rate: float = 1e-4
    encoder_learning_rate: float = 1e-5
    weight_decay: float = 0.01
    learning_rate_warmup_ratio: float = 0.10
    maximum_gradient_norm: float = 1.0
    early_stopping_patience: int = 2
    early_stopping_minimum_delta: float = 0.0
    gradient_accumulation_steps: int = 1
    mixed_precision: str = "auto"
    random_seed: int = 42
    log_every_batches: int = 100
    gradient_checkpointing: bool = False

    def __post_init__(self) -> None:
        if self.classifier_warmup_epochs < 0:
            raise ValueError("classifier_warmup_epochs cannot be negative.")

        if self.maximum_joint_epochs < 1:
            raise ValueError("maximum_joint_epochs must be at least one.")

        for name, value in (
            ("classifier_learning_rate", self.classifier_learning_rate),
            ("encoder_learning_rate", self.encoder_learning_rate),
            ("maximum_gradient_norm", self.maximum_gradient_norm),
        ):
            if value <= 0.0:
                raise ValueError(f"{name} must be positive.")

        if self.weight_decay < 0.0:
            raise ValueError("weight_decay cannot be negative.")

        if not 0.0 <= self.learning_rate_warmup_ratio < 1.0:
            raise ValueError(
                "learning_rate_warmup_ratio must be in [0.0, 1.0)."
            )

        if self.early_stopping_patience < 1:
            raise ValueError("early_stopping_patience must be at least one.")

        if self.early_stopping_minimum_delta < 0.0:
            raise ValueError(
                "early_stopping_minimum_delta cannot be negative."
            )

        if self.gradient_accumulation_steps < 1:
            raise ValueError(
                "gradient_accumulation_steps must be at least one."
            )

        if self.mixed_precision not in {"auto", "none", "fp16", "bf16"}:
            raise ValueError(
                "mixed_precision must be auto, none, fp16, or bf16."
            )

        if self.log_every_batches < 1:
            raise ValueError("log_every_batches must be at least one.")


@dataclass(frozen=True)
class EpochTrainingRecord:
    """Serializable record for one training/validation epoch."""

    global_epoch: int
    stage: str
    stage_epoch: int
    negative_rotation_epoch: int
    duration_seconds: float
    optimizer_updates: int
    train: BinaryVerificationMetrics
    validation: BinaryVerificationMetrics
    learning_rates_after_epoch: dict[str, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "global_epoch": self.global_epoch,
            "stage": self.stage,
            "stage_epoch": self.stage_epoch,
            "negative_rotation_epoch": self.negative_rotation_epoch,
            "duration_seconds": self.duration_seconds,
            "optimizer_updates": self.optimizer_updates,
            "train": self.train.to_dict(),
            "validation": self.validation.to_dict(),
            "learning_rates_after_epoch": self.learning_rates_after_epoch,
        }


@dataclass(frozen=True)
class TrainingRunResult:
    """Final paths and selection result returned by the O1 trainer."""

    output_directory: str
    best_checkpoint: str
    last_checkpoint: str
    history_file: str
    best_global_epoch: int
    best_validation_average_precision: float
    selected_threshold: float
    stopped_early: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class O1VerifierTrainer:
    """
    Two-stage T2 trainer using the selected stable O1 recipe.

    Stage one freezes AraT5 and warms only the random M1 classifier. Stage two
    restores the configured final encoder blocks and jointly fine-tunes them
    with separate learning rates. BCE drives both components. Validation keeps
    its natural class distribution and selects checkpoints by average
    precision, while F2 selects the final decision threshold.
    """

    def __init__(
        self,
        *,
        model: Any,
        train_loader: Any,
        train_sampler: Any,
        validation_loader: Any,
        device: Any,
        output_directory: str | Path,
        config: O1TrainingConfig | None = None,
        overwrite_output: bool = False,
    ) -> None:
        self._require_torch()
        self.model = model
        self.train_loader = train_loader
        self.train_sampler = train_sampler
        self.validation_loader = validation_loader
        self.device = device
        self.output_directory = Path(output_directory)
        self.config = config or O1TrainingConfig()
        self.overwrite_output = overwrite_output
        self.target_unfrozen_blocks = model.config.unfrozen_encoder_blocks
        self.best_checkpoint_path = self.output_directory / "best_model.pt"
        self.last_checkpoint_path = self.output_directory / "last_model.pt"
        self.history_path = self.output_directory / "training_history.json"
        self._prepare_output_directory()
        self._set_random_seed(self.config.random_seed)
        self.model.to(self.device)
        self.criterion = nn.BCEWithLogitsLoss()
        self.amp_dtype = self._resolve_amp_dtype()
        self.scaler = self._build_gradient_scaler()

    @property
    def mixed_precision_name(self) -> str:
        if self.amp_dtype is None:
            return "none"
        if self.amp_dtype == torch.float16:
            return "fp16"
        return "bf16"

    def train(self) -> TrainingRunResult:
        history: list[EpochTrainingRecord] = []
        best_average_precision = -1.0
        best_global_epoch = 0
        best_threshold = 0.5
        validations_without_improvement = 0
        stopped_early = False
        global_epoch = 0

        if self.config.classifier_warmup_epochs > 0:
            self.model.configure_encoder_trainability(0)
            optimizer = self._build_optimizer(include_encoder=False)
            scheduler = self._build_scheduler(
                optimizer,
                epoch_count=self.config.classifier_warmup_epochs,
            )

            for stage_epoch in range(1, self.config.classifier_warmup_epochs + 1):
                global_epoch += 1
                record = self._run_epoch(
                    global_epoch=global_epoch,
                    stage="classifier_warmup",
                    stage_epoch=stage_epoch,
                    optimizer=optimizer,
                    scheduler=scheduler,
                )
                history.append(record)
                improved = (
                    record.validation.average_precision
                    > best_average_precision
                    + self.config.early_stopping_minimum_delta
                )
                if improved:
                    best_average_precision = (
                        record.validation.average_precision
                    )
                    best_global_epoch = global_epoch
                    best_threshold = record.validation.threshold
                    self._save_checkpoint(
                        self.best_checkpoint_path,
                        record,
                        is_best=True,
                    )

                self._save_checkpoint(
                    self.last_checkpoint_path,
                    record,
                    is_best=False,
                )
                self._write_history(
                    history,
                    best_global_epoch=best_global_epoch,
                    best_average_precision=best_average_precision,
                    best_threshold=best_threshold,
                    stopped_early=False,
                )

        self.model.configure_encoder_trainability(self.target_unfrozen_blocks)
        self._enable_gradient_checkpointing_for_joint_stage()
        optimizer = self._build_optimizer(
            include_encoder=self.target_unfrozen_blocks > 0,
        )
        scheduler = self._build_scheduler(
            optimizer,
            epoch_count=self.config.maximum_joint_epochs,
        )

        for stage_epoch in range(1, self.config.maximum_joint_epochs + 1):
            global_epoch += 1
            record = self._run_epoch(
                global_epoch=global_epoch,
                stage="joint_partial_finetuning",
                stage_epoch=stage_epoch,
                optimizer=optimizer,
                scheduler=scheduler,
            )
            history.append(record)
            improved = (
                record.validation.average_precision
                > best_average_precision
                + self.config.early_stopping_minimum_delta
            )

            if improved:
                best_average_precision = record.validation.average_precision
                best_global_epoch = global_epoch
                best_threshold = record.validation.threshold
                validations_without_improvement = 0
                self._save_checkpoint(
                    self.best_checkpoint_path,
                    record,
                    is_best=True,
                )
            else:
                validations_without_improvement += 1

            self._save_checkpoint(
                self.last_checkpoint_path,
                record,
                is_best=False,
            )

            if (
                validations_without_improvement
                >= self.config.early_stopping_patience
            ):
                stopped_early = True

            self._write_history(
                history,
                best_global_epoch=best_global_epoch,
                best_average_precision=best_average_precision,
                best_threshold=best_threshold,
                stopped_early=stopped_early,
            )

            if stopped_early:
                print(
                    "Early stopping: validation average precision did not "
                    f"improve for {validations_without_improvement} joint "
                    "validation(s)."
                )
                break

        if not self.best_checkpoint_path.is_file():
            raise RuntimeError("Training finished without a best checkpoint.")

        load_compact_verifier_checkpoint(
            self.model,
            self.best_checkpoint_path,
            map_location=self.device,
        )
        self.model.configure_encoder_trainability(self.target_unfrozen_blocks)

        result = TrainingRunResult(
            output_directory=str(self.output_directory.resolve()),
            best_checkpoint=str(self.best_checkpoint_path.resolve()),
            last_checkpoint=str(self.last_checkpoint_path.resolve()),
            history_file=str(self.history_path.resolve()),
            best_global_epoch=best_global_epoch,
            best_validation_average_precision=best_average_precision,
            selected_threshold=best_threshold,
            stopped_early=stopped_early,
        )
        self._write_run_result(result)
        return result

    def evaluate(self) -> BinaryVerificationMetrics:
        self.model.eval()
        labels: list[int] = []
        scores: list[float] = []
        total_loss = 0.0
        example_count = 0

        with torch.no_grad():
            for batch in self.validation_loader:
                model_inputs, batch_labels = self._move_batch(batch)

                with self._autocast_context():
                    logits = self.model(**model_inputs)
                    loss = self.criterion(logits, batch_labels)

                batch_size = int(batch_labels.numel())
                total_loss += float(loss.item()) * batch_size
                example_count += batch_size
                labels.extend(
                    int(value)
                    for value in batch_labels.detach().cpu().tolist()
                )
                scores.extend(
                    float(value)
                    for value in torch.sigmoid(logits).detach().cpu().tolist()
                )

        threshold = select_f2_threshold(labels, scores)
        return calculate_binary_metrics(
            labels,
            scores,
            loss=total_loss / example_count,
            threshold=threshold,
        )

    def _run_epoch(
        self,
        *,
        global_epoch: int,
        stage: str,
        stage_epoch: int,
        optimizer: Any,
        scheduler: Any,
    ) -> EpochTrainingRecord:
        rotation_epoch = global_epoch - 1
        self.train_sampler.set_epoch(rotation_epoch)
        started_at = time.monotonic()
        train_metrics, optimizer_updates = self._train_one_epoch(
            optimizer,
            scheduler,
            global_epoch=global_epoch,
            stage=stage,
        )
        validation_metrics = self.evaluate()
        duration = time.monotonic() - started_at
        learning_rates = {
            group.get("name", f"group_{index}"): float(group["lr"])
            for index, group in enumerate(optimizer.param_groups)
        }

        record = EpochTrainingRecord(
            global_epoch=global_epoch,
            stage=stage,
            stage_epoch=stage_epoch,
            negative_rotation_epoch=rotation_epoch,
            duration_seconds=duration,
            optimizer_updates=optimizer_updates,
            train=train_metrics,
            validation=validation_metrics,
            learning_rates_after_epoch=learning_rates,
        )
        self._print_epoch_result(record)
        return record

    def _train_one_epoch(
        self,
        optimizer: Any,
        scheduler: Any,
        *,
        global_epoch: int,
        stage: str,
    ) -> tuple[BinaryVerificationMetrics, int]:
        self.model.train()

        if self.model.trainability_summary().unfrozen_encoder_blocks == 0:
            # During the T2 classifier warm-up, make AraT5 a truly stable
            # feature extractor by also disabling its dropout.
            self.model.encoder.eval()

        optimizer.zero_grad(set_to_none=True)
        labels: list[int] = []
        scores: list[float] = []
        total_loss = 0.0
        example_count = 0
        optimizer_updates = 0
        batch_count = len(self.train_loader)
        accumulation = self.config.gradient_accumulation_steps

        for batch_index, batch in enumerate(self.train_loader, start=1):
            model_inputs, batch_labels = self._move_batch(batch)
            group_start = ((batch_index - 1) // accumulation) * accumulation + 1
            group_size = min(
                accumulation,
                batch_count - group_start + 1,
            )

            with self._autocast_context():
                logits = self.model(**model_inputs)
                loss = self.criterion(logits, batch_labels)
                scaled_loss = loss / group_size

            if self.scaler is not None:
                self.scaler.scale(scaled_loss).backward()
            else:
                scaled_loss.backward()

            batch_size = int(batch_labels.numel())
            total_loss += float(loss.detach().item()) * batch_size
            example_count += batch_size
            labels.extend(
                int(value)
                for value in batch_labels.detach().cpu().tolist()
            )
            scores.extend(
                float(value)
                for value in torch.sigmoid(logits).detach().cpu().tolist()
            )

            should_update = (
                batch_index % accumulation == 0 or batch_index == batch_count
            )
            if should_update:
                self._optimizer_step(optimizer, scheduler)
                optimizer_updates += 1

            if (
                batch_index % self.config.log_every_batches == 0
                or batch_index == batch_count
            ):
                print(
                    f"Epoch {global_epoch} [{stage}] "
                    f"batch {batch_index}/{batch_count} "
                    f"loss={total_loss / example_count:.6f}"
                )

        metrics = calculate_binary_metrics(
            labels,
            scores,
            loss=total_loss / example_count,
            threshold=0.5,
        )
        return metrics, optimizer_updates

    def _optimizer_step(self, optimizer: Any, scheduler: Any) -> None:
        if self.scaler is not None:
            self.scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(
                (
                    parameter
                    for parameter in self.model.parameters()
                    if parameter.requires_grad
                ),
                self.config.maximum_gradient_norm,
            )
            previous_scale = self.scaler.get_scale()
            self.scaler.step(optimizer)
            self.scaler.update()
            update_succeeded = self.scaler.get_scale() >= previous_scale
        else:
            torch.nn.utils.clip_grad_norm_(
                (
                    parameter
                    for parameter in self.model.parameters()
                    if parameter.requires_grad
                ),
                self.config.maximum_gradient_norm,
            )
            optimizer.step()
            update_succeeded = True

        if update_succeeded:
            scheduler.step()

        optimizer.zero_grad(set_to_none=True)

    def _build_optimizer(self, *, include_encoder: bool) -> Any:
        parameter_groups = [
            {
                "name": "classifier",
                "params": [
                    parameter
                    for parameter in self.model.classifier.parameters()
                    if parameter.requires_grad
                ],
                "lr": self.config.classifier_learning_rate,
            }
        ]

        if include_encoder:
            encoder_parameters = [
                parameter
                for parameter in self.model.encoder.parameters()
                if parameter.requires_grad
            ]
            if not encoder_parameters:
                raise RuntimeError(
                    "Joint fine-tuning requested an empty encoder parameter "
                    "group."
                )
            parameter_groups.append(
                {
                    "name": "encoder",
                    "params": encoder_parameters,
                    "lr": self.config.encoder_learning_rate,
                }
            )

        return torch.optim.AdamW(
            parameter_groups,
            weight_decay=self.config.weight_decay,
        )

    def _build_scheduler(self, optimizer: Any, *, epoch_count: int) -> Any:
        updates_per_epoch = math.ceil(
            len(self.train_loader)
            / self.config.gradient_accumulation_steps
        )
        total_updates = max(1, updates_per_epoch * epoch_count)
        warmup_updates = int(
            total_updates * self.config.learning_rate_warmup_ratio
        )

        if self.config.learning_rate_warmup_ratio > 0.0:
            warmup_updates = max(1, warmup_updates)

        def multiplier(current_update: int) -> float:
            if warmup_updates > 0 and current_update < warmup_updates:
                return current_update / warmup_updates

            remaining = total_updates - current_update
            decay_updates = max(1, total_updates - warmup_updates)
            return max(0.0, remaining / decay_updates)

        return torch.optim.lr_scheduler.LambdaLR(optimizer, multiplier)

    def _move_batch(self, batch: dict[str, Any]) -> tuple[dict[str, Any], Any]:
        non_blocking = self.device.type == "cuda"
        model_inputs = {
            "submitted_input_ids": batch["submitted_input_ids"].to(
                self.device,
                non_blocking=non_blocking,
            ),
            "submitted_attention_mask": batch[
                "submitted_attention_mask"
            ].to(self.device, non_blocking=non_blocking),
            "source_input_ids": batch["source_input_ids"].to(
                self.device,
                non_blocking=non_blocking,
            ),
            "source_attention_mask": batch["source_attention_mask"].to(
                self.device,
                non_blocking=non_blocking,
            ),
        }
        labels = batch["labels"].to(
            self.device,
            non_blocking=non_blocking,
        )
        return model_inputs, labels

    def _resolve_amp_dtype(self) -> Any | None:
        requested = self.config.mixed_precision

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
                    "bf16 was requested, but this CUDA GPU does not support "
                    "it. Use auto or fp16."
                )
            return torch.bfloat16

        return torch.bfloat16 if bf16_supported else torch.float16

    def _enable_gradient_checkpointing_for_joint_stage(self) -> None:
        if not self.config.gradient_checkpointing:
            return

        enable = getattr(
            self.model.encoder,
            "gradient_checkpointing_enable",
            None,
        )
        if enable is None:
            raise ValueError(
                "The selected encoder does not support gradient "
                "checkpointing."
            )
        enable()

        # Older checkpoint implementations require at least one input tensor
        # with requires_grad=True. With frozen embeddings/lower blocks, this
        # hook preserves gradients for the selected final blocks without
        # making frozen weights optimizer parameters.
        if 0 < self.target_unfrozen_blocks < self.model.encoder_block_count:
            enable_input_grads = getattr(
                self.model.encoder,
                "enable_input_require_grads",
                None,
            )
            if enable_input_grads is not None:
                enable_input_grads()

    def _build_gradient_scaler(self) -> Any | None:
        if self.amp_dtype != torch.float16:
            return None

        try:
            return torch.amp.GradScaler("cuda")
        except (AttributeError, TypeError):  # Older supported PyTorch.
            return torch.cuda.amp.GradScaler()

    def _autocast_context(self) -> Any:
        return torch.autocast(
            device_type=self.device.type,
            dtype=self.amp_dtype,
            enabled=self.amp_dtype is not None,
        )

    def _save_checkpoint(
        self,
        path: Path,
        record: EpochTrainingRecord,
        *,
        is_best: bool,
    ) -> None:
        payload = {
            "checkpoint_format": "arat5_siamese_compact_v1",
            "encoder_model_name": self.model.config.encoder_model_name,
            "model_config": asdict(self.model.config),
            "training_config": asdict(self.config),
            "target_unfrozen_encoder_blocks": self.target_unfrozen_blocks,
            "global_epoch": record.global_epoch,
            "stage": record.stage,
            "stage_epoch": record.stage_epoch,
            "is_best": is_best,
            "validation_metrics": record.validation.to_dict(),
            "selected_threshold": record.validation.threshold,
            "model_state_dict": self.model.compact_checkpoint_state_dict(
                self.target_unfrozen_blocks
            ),
        }
        _atomic_torch_save(payload, path)

    def _write_history(
        self,
        history: list[EpochTrainingRecord],
        *,
        best_global_epoch: int,
        best_average_precision: float,
        best_threshold: float,
        stopped_early: bool,
    ) -> None:
        payload = {
            "model_config": asdict(self.model.config),
            "training_config": asdict(self.config),
            "device": str(self.device),
            "mixed_precision": self.mixed_precision_name,
            "best_global_epoch": best_global_epoch,
            "best_validation_average_precision": best_average_precision,
            "selected_threshold": best_threshold,
            "stopped_early": stopped_early,
            "epochs": [record.to_dict() for record in history],
        }
        _atomic_json_write(payload, self.history_path)

    def _write_run_result(self, result: TrainingRunResult) -> None:
        _atomic_json_write(
            result.to_dict(),
            self.output_directory / "run_result.json",
        )

    def _prepare_output_directory(self) -> None:
        self.output_directory.mkdir(parents=True, exist_ok=True)
        protected_paths = (
            self.best_checkpoint_path,
            self.last_checkpoint_path,
            self.history_path,
            self.output_directory / "run_result.json",
        )
        existing = [path for path in protected_paths if path.exists()]

        if existing and not self.overwrite_output:
            formatted = ", ".join(str(path) for path in existing)
            raise FileExistsError(
                "Training output already exists: "
                f"{formatted}. Use a new output directory or explicitly "
                "enable overwrite_output."
            )

    @staticmethod
    def _set_random_seed(seed: int) -> None:
        random.seed(seed)

        try:
            import numpy as np
        except ImportError:
            np = None

        if np is not None:
            np.random.seed(seed)

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

    @staticmethod
    def _print_epoch_result(record: EpochTrainingRecord) -> None:
        validation = record.validation
        print()
        print("-" * 88)
        print(
            f"Epoch {record.global_epoch} complete "
            f"({record.stage}, stage epoch {record.stage_epoch})"
        )
        print(f"Duration:               {record.duration_seconds / 60:.2f} min")
        print(f"Training loss:          {record.train.loss:.6f}")
        print(f"Validation loss:        {validation.loss:.6f}")
        print(f"Validation AP/PR-AUC:   {validation.average_precision:.6f}")
        print(f"Selected F2 threshold: {validation.threshold:.6f}")
        print(f"Validation precision:   {validation.precision:.6f}")
        print(f"Validation recall:      {validation.recall:.6f}")
        print(f"Validation F1:          {validation.f1:.6f}")
        print(f"Validation F2:          {validation.f2:.6f}")
        print("-" * 88)

    @staticmethod
    def _require_torch() -> None:
        if torch is None or nn is None:
            raise ImportError(
                "PyTorch is required to train the AraT5 Siamese verifier."
            )


def load_compact_verifier_checkpoint(
    model: Any,
    checkpoint_path: str | Path,
    *,
    map_location: Any = "cpu",
) -> dict[str, Any]:
    """Load verifier changes on top of the checkpoint's base AraT5 model."""
    if torch is None:
        raise ImportError("PyTorch is required to load verifier weights.")

    checkpoint_path = Path(checkpoint_path)

    try:
        payload = torch.load(
            checkpoint_path,
            map_location=map_location,
            weights_only=False,
        )
    except TypeError:  # PyTorch versions before the weights_only argument.
        payload = torch.load(checkpoint_path, map_location=map_location)

    if payload.get("checkpoint_format") != "arat5_siamese_compact_v1":
        raise ValueError("Unsupported verifier checkpoint format.")

    if payload.get("encoder_model_name") != model.config.encoder_model_name:
        raise ValueError(
            "Checkpoint base encoder does not match the loaded model: "
            f"{payload.get('encoder_model_name')!r} != "
            f"{model.config.encoder_model_name!r}."
        )

    state = payload.get("model_state_dict")
    if not isinstance(state, dict) or not state:
        raise ValueError("Verifier checkpoint contains no model weights.")

    _, unexpected = model.load_state_dict(state, strict=False)
    if unexpected:
        raise ValueError(
            "Verifier checkpoint contains unexpected parameters: "
            f"{unexpected[:5]}"
        )

    target_blocks = payload.get("target_unfrozen_encoder_blocks")
    model.configure_encoder_trainability(target_blocks)
    return payload


def _atomic_torch_save(payload: dict[str, Any], path: Path) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    torch.save(payload, temporary_path)
    os.replace(temporary_path, path)


def _atomic_json_write(payload: dict[str, Any], path: Path) -> None:
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
    os.replace(temporary_path, path)
