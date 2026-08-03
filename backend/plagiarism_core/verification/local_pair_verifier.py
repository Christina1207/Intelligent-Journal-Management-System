from __future__ import annotations

import gc
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from plagiarism_core.schemas import VerificationInput, VerificationResult
from plagiarism_core.verification.siamese_model import (
    AraT5SiameseConfig,
    AraT5SiameseVerifier,
)
from plagiarism_core.verification.trainer import (
    load_compact_verifier_checkpoint,
)


DEFAULT_VERIFIER_THRESHOLD = 0.349609375
DEFAULT_VERIFIER_EPOCH = 7
DEFAULT_ENCODER_MODEL_ID = "UBC-NLP/AraT5v2-base-1024"
DEFAULT_CHECKPOINT_ID = "f2_x2_o1_c1/best_model.pt"


@dataclass(frozen=True)
class LocalVerifierCheckpointInfo:
    """Validated metadata from one compact AraT5 verifier checkpoint."""

    path: str
    checkpoint_format: str
    encoder_model_name: str
    global_epoch: int
    selected_threshold: float
    model_config: dict[str, Any]
    target_unfrozen_encoder_blocks: int


@dataclass(frozen=True)
class LocalAraT5PairVerifierConfig:
    """Configuration for reusable local production inference."""

    base_model_directory: str | Path = "models/AraT5v2-base-1024"
    checkpoint_path: str | Path = (
        "models/verifier/f2_x2_o1_c1/best_model.pt"
    )
    checkpoint_id: str = DEFAULT_CHECKPOINT_ID
    expected_epoch: int = DEFAULT_VERIFIER_EPOCH
    expected_threshold: float = DEFAULT_VERIFIER_THRESHOLD
    batch_size: int = 8
    max_length: int = 512
    device: str = "auto"
    mixed_precision: str = "auto"

    def __post_init__(self) -> None:
        if not self.checkpoint_id:
            raise ValueError("checkpoint_id cannot be empty.")
        if self.expected_epoch < 1:
            raise ValueError("expected_epoch must be positive.")
        if not 0.0 <= self.expected_threshold <= 1.0:
            raise ValueError("expected_threshold must be in [0, 1].")
        if self.batch_size < 1:
            raise ValueError("batch_size must be positive.")
        if self.max_length < 1:
            raise ValueError("max_length must be positive.")
        if self.device not in {"auto", "cpu", "cuda"}:
            raise ValueError("device must be auto, cpu, or cuda.")
        if self.mixed_precision not in {
            "auto",
            "none",
            "fp16",
            "bf16",
        }:
            raise ValueError(
                "mixed_precision must be auto, none, fp16, or bf16."
            )


class LocalAraT5PairVerifier:
    """
    Load the local AraT5 encoder and compact epoch-7 checkpoint once.

    The object implements the stable PairVerifier boundary and is intended to
    be reused across document checks. Inputs remain in memory; no prediction
    JSONL is created.
    """

    def __init__(
        self,
        *,
        model: Any,
        tokenizer: Any,
        device: Any,
        checkpoint: LocalVerifierCheckpointInfo,
        checkpoint_id: str,
        batch_size: int,
        max_length: int,
        amp_dtype: Any | None,
        torch_module: Any,
    ) -> None:
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.checkpoint = checkpoint
        self.checkpoint_id = checkpoint_id
        self.batch_size = batch_size
        self.max_length = max_length
        self.amp_dtype = amp_dtype
        self._torch = torch_module

    @classmethod
    def load(
        cls,
        config: LocalAraT5PairVerifierConfig | None = None,
    ) -> "LocalAraT5PairVerifier":
        """Build a ready-to-use verifier from self-contained local assets."""
        resolved = config or LocalAraT5PairVerifierConfig()
        base_directory = validate_local_arat5_directory(
            resolved.base_model_directory
        )
        checkpoint = inspect_compact_verifier_checkpoint(
            resolved.checkpoint_path,
            expected_epoch=resolved.expected_epoch,
            expected_threshold=resolved.expected_threshold,
        )

        try:
            import torch
            from transformers import AutoTokenizer, T5EncoderModel
        except ImportError as exc:
            raise ImportError(
                "Install the dependencies from requirements.txt before "
                "loading the local verifier."
            ) from exc

        device = _resolve_device(resolved.device, torch)
        amp_dtype = _resolve_amp_dtype(
            resolved.mixed_precision,
            device=device,
            torch_module=torch,
        )
        model_config = AraT5SiameseConfig(**checkpoint.model_config)

        tokenizer = AutoTokenizer.from_pretrained(
            str(base_directory),
            local_files_only=True,
        )
        encoder = T5EncoderModel.from_pretrained(
            str(base_directory),
            local_files_only=True,
        )
        model = AraT5SiameseVerifier(
            encoder=encoder,
            config=model_config,
        )
        loaded_payload = load_compact_verifier_checkpoint(
            model,
            resolved.checkpoint_path,
            map_location="cpu",
        )
        del loaded_payload
        gc.collect()

        model.to(device)
        model.eval()
        return cls(
            model=model,
            tokenizer=tokenizer,
            device=device,
            checkpoint=checkpoint,
            checkpoint_id=resolved.checkpoint_id,
            batch_size=resolved.batch_size,
            max_length=resolved.max_length,
            amp_dtype=amp_dtype,
            torch_module=torch,
        )

    @property
    def model_name(self) -> str:
        return self.checkpoint.encoder_model_name

    @property
    def model_version(self) -> str:
        return self.checkpoint_id

    @property
    def threshold(self) -> float:
        return self.checkpoint.selected_threshold

    @property
    def checkpoint_epoch(self) -> int:
        return self.checkpoint.global_epoch

    @property
    def supported_representation_languages(self) -> frozenset[str]:
        return frozenset({"ar"})

    @property
    def mixed_precision_name(self) -> str:
        if self.amp_dtype is None:
            return "none"
        if self.amp_dtype == self._torch.float16:
            return "fp16"
        return "bf16"

    def verify_batch(
        self,
        inputs: Sequence[VerificationInput],
    ) -> list[VerificationResult]:
        """Score candidate pairs in stable input order."""
        if not inputs:
            return []

        seen_pair_ids: set[str] = set()
        for item in inputs:
            if item.pair_id in seen_pair_ids:
                raise ValueError(
                    f"Duplicate verification pair_id: {item.pair_id!r}."
                )
            seen_pair_ids.add(item.pair_id)
            if (
                item.representation_language
                not in self.supported_representation_languages
            ):
                raise ValueError(
                    "The local AraT5 verifier supports only Arabic "
                    f"representations, got {item.representation_language!r}."
                )

        results: list[VerificationResult] = []
        for start in range(0, len(inputs), self.batch_size):
            batch = inputs[start : start + self.batch_size]
            probabilities = self._score_batch(batch)
            for item, probability in zip(batch, probabilities):
                results.append(
                    VerificationResult(
                        pair_id=item.pair_id,
                        plagiarism_probability=probability,
                        is_potential_match=probability >= self.threshold,
                        threshold=self.threshold,
                        model_name=self.model_name,
                        model_version=self.model_version,
                        metadata={
                            "checkpoint_epoch": self.checkpoint_epoch,
                            "checkpoint_format": (
                                self.checkpoint.checkpoint_format
                            ),
                            "mixed_precision": self.mixed_precision_name,
                            "device": str(self.device),
                            "max_length": self.max_length,
                        },
                    )
                )
        return results

    def _score_batch(
        self,
        inputs: Sequence[VerificationInput],
    ) -> list[float]:
        submitted_texts: list[str] = []
        source_texts: list[str] = []
        for item in inputs:
            submitted_text, source_text = item.model_texts(
                use_normalized_text=False
            )
            submitted_texts.append(submitted_text)
            source_texts.append(source_text)

        submitted_tokens = self._tokenize(submitted_texts)
        source_tokens = self._tokenize(source_texts)
        with self._torch.inference_mode():
            with self._torch.autocast(
                device_type=self.device.type,
                dtype=self.amp_dtype,
                enabled=self.amp_dtype is not None,
            ):
                logits = self.model(
                    submitted_input_ids=submitted_tokens["input_ids"],
                    submitted_attention_mask=(
                        submitted_tokens["attention_mask"]
                    ),
                    source_input_ids=source_tokens["input_ids"],
                    source_attention_mask=source_tokens["attention_mask"],
                )
            probabilities = self._torch.sigmoid(logits)

        return [
            float(value)
            for value in probabilities.detach().float().cpu().tolist()
        ]

    def _tokenize(self, texts: Sequence[str]) -> Mapping[str, Any]:
        tokens = self.tokenizer(
            list(texts),
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
        return {
            "input_ids": tokens["input_ids"].to(self.device),
            "attention_mask": tokens["attention_mask"].to(self.device),
        }


def validate_local_arat5_directory(path: str | Path) -> Path:
    """Fail early when the M1 local base-model installation is incomplete."""
    directory = Path(path)
    if not directory.is_dir():
        raise FileNotFoundError(
            f"Local AraT5 model directory does not exist: {directory}"
        )

    required = (directory / "config.json", directory / "tokenizer_config.json")
    missing = [item.name for item in required if not item.is_file()]
    weight_files = (
        directory / "model.safetensors",
        directory / "pytorch_model.bin",
    )
    if not any(item.is_file() for item in weight_files):
        missing.append("model.safetensors or pytorch_model.bin")

    tokenizer_files = (
        directory / "spiece.model",
        directory / "tokenizer.json",
    )
    if not any(item.is_file() for item in tokenizer_files):
        missing.append("spiece.model or tokenizer.json")

    if missing:
        raise FileNotFoundError(
            "Local AraT5 installation is incomplete. Missing: "
            + ", ".join(missing)
        )
    return directory


def inspect_compact_verifier_checkpoint(
    path: str | Path,
    *,
    expected_epoch: int = DEFAULT_VERIFIER_EPOCH,
    expected_threshold: float = DEFAULT_VERIFIER_THRESHOLD,
) -> LocalVerifierCheckpointInfo:
    """Load and validate checkpoint metadata before the base model is loaded."""
    try:
        import torch
    except ImportError as exc:
        raise ImportError(
            "PyTorch is required to inspect the verifier checkpoint."
        ) from exc

    checkpoint_path = Path(path)
    if not checkpoint_path.is_file():
        raise FileNotFoundError(
            f"Verifier checkpoint does not exist: {checkpoint_path}"
        )
    try:
        payload = torch.load(
            checkpoint_path,
            map_location="cpu",
            weights_only=False,
        )
    except TypeError:
        payload = torch.load(checkpoint_path, map_location="cpu")
    return validate_compact_verifier_checkpoint_payload(
        payload,
        path=checkpoint_path,
        expected_epoch=expected_epoch,
        expected_threshold=expected_threshold,
    )


def validate_compact_verifier_checkpoint_payload(
    payload: Any,
    *,
    path: str | Path = "<memory>",
    expected_epoch: int = DEFAULT_VERIFIER_EPOCH,
    expected_threshold: float = DEFAULT_VERIFIER_THRESHOLD,
) -> LocalVerifierCheckpointInfo:
    """Validate the frozen checkpoint contract without loading AraT5."""
    if not isinstance(payload, Mapping):
        raise ValueError("Verifier checkpoint payload must be a dictionary.")
    checkpoint_format = payload.get("checkpoint_format")
    if checkpoint_format != "arat5_siamese_compact_v1":
        raise ValueError(
            f"Unsupported verifier checkpoint format: {checkpoint_format!r}."
        )

    epoch = payload.get("global_epoch")
    if epoch != expected_epoch:
        raise ValueError(
            "Wrong verifier checkpoint: expected global epoch "
            f"{expected_epoch}, got {epoch!r}."
        )

    threshold = payload.get("selected_threshold")
    if not isinstance(threshold, (int, float)) or isinstance(threshold, bool):
        raise ValueError("Checkpoint contains no valid selected_threshold.")
    threshold = float(threshold)
    if not math.isclose(
        threshold,
        expected_threshold,
        rel_tol=0.0,
        abs_tol=1e-12,
    ):
        raise ValueError(
            "Checkpoint threshold is not the frozen validation threshold: "
            f"{threshold!r} != {expected_threshold!r}."
        )

    model_config = payload.get("model_config")
    if not isinstance(model_config, Mapping):
        raise ValueError("Checkpoint contains no valid model_config.")
    model_config = dict(model_config)
    encoder_name = payload.get("encoder_model_name")
    if not isinstance(encoder_name, str) or not encoder_name:
        raise ValueError("Checkpoint contains no valid encoder_model_name.")
    if model_config.get("encoder_model_name") != encoder_name:
        raise ValueError(
            "Checkpoint encoder_model_name and model_config disagree."
        )
    if encoder_name != DEFAULT_ENCODER_MODEL_ID:
        raise ValueError(
            "Unexpected checkpoint base encoder: "
            f"{encoder_name!r} != {DEFAULT_ENCODER_MODEL_ID!r}."
        )

    target_blocks = payload.get("target_unfrozen_encoder_blocks")
    if not isinstance(target_blocks, int) or isinstance(target_blocks, bool):
        raise ValueError(
            "Checkpoint has no valid target_unfrozen_encoder_blocks."
        )
    if target_blocks != model_config.get("unfrozen_encoder_blocks"):
        raise ValueError(
            "Checkpoint target encoder blocks and model_config disagree."
        )

    state = payload.get("model_state_dict")
    if not isinstance(state, Mapping) or not state:
        raise ValueError("Verifier checkpoint contains no model weights.")

    return LocalVerifierCheckpointInfo(
        path=str(Path(path)),
        checkpoint_format=checkpoint_format,
        encoder_model_name=encoder_name,
        global_epoch=epoch,
        selected_threshold=threshold,
        model_config=model_config,
        target_unfrozen_encoder_blocks=target_blocks,
    )


def _resolve_device(requested: str, torch_module: Any) -> Any:
    cuda_available = torch_module.cuda.is_available()
    if requested == "auto":
        return torch_module.device("cuda" if cuda_available else "cpu")
    if requested == "cuda" and not cuda_available:
        raise RuntimeError(
            "CUDA was requested, but PyTorch cannot access a CUDA GPU."
        )
    return torch_module.device(requested)


def _resolve_amp_dtype(
    requested: str,
    *,
    device: Any,
    torch_module: Any,
) -> Any | None:
    if device.type != "cuda" or requested == "none":
        return None
    if requested == "fp16":
        return torch_module.float16

    bf16_supported = bool(
        getattr(torch_module.cuda, "is_bf16_supported", lambda: False)()
    )
    if requested == "bf16":
        if not bf16_supported:
            raise ValueError(
                "bf16 was requested, but this CUDA GPU does not support it."
            )
        return torch_module.bfloat16
    return torch_module.bfloat16 if bf16_supported else torch_module.float16
