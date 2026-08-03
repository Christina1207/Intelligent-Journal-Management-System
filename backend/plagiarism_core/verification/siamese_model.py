from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

try:
    import torch
    from torch import nn
except ImportError:  # Keep schema/data utilities importable without PyTorch.
    torch = None
    nn = None


@dataclass(frozen=True)
class AraT5SiameseConfig:
    """Configuration for the M1 symmetric AraT5 verifier."""

    encoder_model_name: str = "UBC-NLP/AraT5v2-base-1024"
    unfrozen_encoder_blocks: int = 2
    classifier_hidden_size: int = 256
    classifier_dropout: float = 0.10

    def __post_init__(self) -> None:
        if not self.encoder_model_name.strip():
            raise ValueError("encoder_model_name cannot be empty.")

        if self.unfrozen_encoder_blocks < 0:
            raise ValueError("unfrozen_encoder_blocks cannot be negative.")

        if self.classifier_hidden_size < 1:
            raise ValueError("classifier_hidden_size must be positive.")

        if not 0.0 <= self.classifier_dropout < 1.0:
            raise ValueError(
                "classifier_dropout must be in the interval [0.0, 1.0)."
            )


@dataclass(frozen=True)
class ModelTrainabilitySummary:
    """Auditable description of which verifier parameters can change."""

    model_name: str
    encoder_block_count: int
    unfrozen_encoder_blocks: int
    unfrozen_block_indices: tuple[int, ...]
    encoder_parameter_count: int
    trainable_encoder_parameter_count: int
    classifier_parameter_count: int
    trainable_classifier_parameter_count: int

    @property
    def total_parameter_count(self) -> int:
        return self.encoder_parameter_count + self.classifier_parameter_count

    @property
    def trainable_parameter_count(self) -> int:
        return (
            self.trainable_encoder_parameter_count
            + self.trainable_classifier_parameter_count
        )

    @property
    def trainable_parameter_fraction(self) -> float:
        if self.total_parameter_count == 0:
            return 0.0

        return self.trainable_parameter_count / self.total_parameter_count

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["total_parameter_count"] = self.total_parameter_count
        result["trainable_parameter_count"] = self.trainable_parameter_count
        result["trainable_parameter_fraction"] = (
            self.trainable_parameter_fraction
        )
        return result


_ModuleBase = nn.Module if nn is not None else object


class AraT5SiameseVerifier(_ModuleBase):
    """
    M1 Siamese verifier with one shared AraT5 encoder.

    Both passages are encoded independently by the same encoder. Masked mean
    pooling produces embeddings A and B. The classifier receives only the
    symmetric features ``abs(A - B)`` and ``A * B``, so passage order does not
    affect the prediction when the model is in evaluation mode.
    """

    def __init__(
        self,
        encoder: Any,
        config: AraT5SiameseConfig | None = None,
    ) -> None:
        self._require_torch()
        super().__init__()

        self.config = config or AraT5SiameseConfig()
        self.encoder = encoder
        self._blocks = self._resolve_encoder_blocks(encoder)
        self._hidden_size = self._resolve_hidden_size(encoder)

        if self.config.unfrozen_encoder_blocks > len(self._blocks):
            raise ValueError(
                "unfrozen_encoder_blocks cannot exceed the encoder's "
                f"{len(self._blocks)} transformer blocks."
            )

        comparison_size = self._hidden_size * 2
        self.classifier = nn.Sequential(
            nn.Linear(
                comparison_size,
                self.config.classifier_hidden_size,
            ),
            nn.GELU(),
            nn.Dropout(self.config.classifier_dropout),
            nn.Linear(self.config.classifier_hidden_size, 1),
        )
        self.configure_encoder_trainability(
            self.config.unfrozen_encoder_blocks
        )

    @classmethod
    def from_pretrained(
        cls,
        config: AraT5SiameseConfig | None = None,
        **encoder_loading_kwargs: Any,
    ) -> "AraT5SiameseVerifier":
        """Load the encoder-only part of the configured AraT5 checkpoint."""
        cls._require_torch()
        resolved_config = config or AraT5SiameseConfig()

        try:
            from transformers import T5EncoderModel
        except ImportError as exc:
            raise ImportError(
                "transformers is required to load the AraT5 verifier."
            ) from exc

        encoder = T5EncoderModel.from_pretrained(
            resolved_config.encoder_model_name,
            **encoder_loading_kwargs,
        )
        return cls(encoder=encoder, config=resolved_config)

    @property
    def model_name(self) -> str:
        return self.config.encoder_model_name

    @property
    def supported_representation_languages(self) -> frozenset[str]:
        return frozenset({"ar"})

    @property
    def encoder_block_count(self) -> int:
        return len(self._blocks)

    @property
    def hidden_size(self) -> int:
        return self._hidden_size

    def configure_encoder_trainability(
        self,
        unfrozen_encoder_blocks: int,
    ) -> None:
        """
        Apply F1, partial F2, or full F3 trainability by block count.

        ``0`` freezes the complete encoder. Values between ``1`` and ``N-1``
        train only the last selected transformer blocks. ``N`` makes the
        complete encoder trainable, including embeddings and final layer
        normalization, and therefore represents full fine-tuning.
        """
        if not isinstance(unfrozen_encoder_blocks, int) or isinstance(
            unfrozen_encoder_blocks, bool
        ):
            raise TypeError("unfrozen_encoder_blocks must be an integer.")

        if not 0 <= unfrozen_encoder_blocks <= len(self._blocks):
            raise ValueError(
                "unfrozen_encoder_blocks must be between 0 and "
                f"{len(self._blocks)}."
            )

        for parameter in self.encoder.parameters():
            parameter.requires_grad = False

        if unfrozen_encoder_blocks == len(self._blocks):
            for parameter in self.encoder.parameters():
                parameter.requires_grad = True
        elif unfrozen_encoder_blocks > 0:
            for block in self._blocks[-unfrozen_encoder_blocks:]:
                for parameter in block.parameters():
                    parameter.requires_grad = True

        self._unfrozen_encoder_blocks = unfrozen_encoder_blocks

    def trainability_summary(self) -> ModelTrainabilitySummary:
        """Return counts suitable for logs and experiment reports."""
        encoder_parameters = tuple(self.encoder.parameters())
        classifier_parameters = tuple(self.classifier.parameters())
        start = len(self._blocks) - self._unfrozen_encoder_blocks
        unfrozen_indices = tuple(
            range(start, len(self._blocks))
        ) if self._unfrozen_encoder_blocks else ()

        return ModelTrainabilitySummary(
            model_name=self.model_name,
            encoder_block_count=len(self._blocks),
            unfrozen_encoder_blocks=self._unfrozen_encoder_blocks,
            unfrozen_block_indices=unfrozen_indices,
            encoder_parameter_count=self._parameter_count(
                encoder_parameters
            ),
            trainable_encoder_parameter_count=self._parameter_count(
                parameter
                for parameter in encoder_parameters
                if parameter.requires_grad
            ),
            classifier_parameter_count=self._parameter_count(
                classifier_parameters
            ),
            trainable_classifier_parameter_count=self._parameter_count(
                parameter
                for parameter in classifier_parameters
                if parameter.requires_grad
            ),
        )

    def compact_checkpoint_state_dict(
        self,
        unfrozen_encoder_blocks: int | None = None,
    ) -> dict[str, Any]:
        """
        Return only weights that can differ from the base checkpoint.

        The classifier is always included. For partial fine-tuning, only the
        selected final encoder blocks are added. Omitted frozen AraT5 weights
        are restored by loading ``encoder_model_name`` before this compact
        checkpoint, which keeps Colab downloads much smaller than 1.47 GB.
        """
        selected_blocks = (
            self.config.unfrozen_encoder_blocks
            if unfrozen_encoder_blocks is None
            else unfrozen_encoder_blocks
        )
        parameter_names = self.checkpoint_parameter_names(selected_blocks)
        state = self.state_dict()
        return {
            name: state[name].detach().cpu().clone()
            for name in parameter_names
        }

    def checkpoint_parameter_names(
        self,
        unfrozen_encoder_blocks: int | None = None,
    ) -> tuple[str, ...]:
        """Return parameter names needed by a compact verifier checkpoint."""
        selected_blocks = (
            self.config.unfrozen_encoder_blocks
            if unfrozen_encoder_blocks is None
            else unfrozen_encoder_blocks
        )

        if not isinstance(selected_blocks, int) or isinstance(
            selected_blocks,
            bool,
        ):
            raise TypeError("unfrozen_encoder_blocks must be an integer.")

        if not 0 <= selected_blocks <= len(self._blocks):
            raise ValueError(
                "unfrozen_encoder_blocks must be between 0 and "
                f"{len(self._blocks)}."
            )

        selected_parameter_ids = {
            id(parameter) for parameter in self.classifier.parameters()
        }

        if selected_blocks == len(self._blocks):
            selected_parameter_ids.update(
                id(parameter) for parameter in self.encoder.parameters()
            )
        elif selected_blocks > 0:
            for block in self._blocks[-selected_blocks:]:
                selected_parameter_ids.update(
                    id(parameter) for parameter in block.parameters()
                )

        return tuple(
            name
            for name, parameter in self.named_parameters()
            if id(parameter) in selected_parameter_ids
        )

    def forward(
        self,
        submitted_input_ids: Any,
        submitted_attention_mask: Any,
        source_input_ids: Any,
        source_attention_mask: Any,
    ) -> Any:
        """Return one unnormalized match logit for every passage pair."""
        submitted_embedding = self.encode(
            submitted_input_ids,
            submitted_attention_mask,
        )
        source_embedding = self.encode(
            source_input_ids,
            source_attention_mask,
        )
        features = self.symmetric_comparison_features(
            submitted_embedding,
            source_embedding,
        )
        return self.classifier(features).squeeze(-1)

    def encode(self, input_ids: Any, attention_mask: Any) -> Any:
        """Encode and masked-mean-pool one branch of a Siamese pair."""
        outputs = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask,
            return_dict=True,
        )

        if not hasattr(outputs, "last_hidden_state"):
            raise ValueError(
                "Encoder output needs a last_hidden_state tensor."
            )

        return self.masked_mean_pool(
            outputs.last_hidden_state,
            attention_mask,
        )

    @staticmethod
    def masked_mean_pool(last_hidden_state: Any, attention_mask: Any) -> Any:
        """Average only non-padding token states for each passage."""
        AraT5SiameseVerifier._require_torch()

        if last_hidden_state.ndim != 3:
            raise ValueError(
                "last_hidden_state must have shape "
                "(batch, sequence, hidden)."
            )

        if attention_mask.ndim != 2:
            raise ValueError(
                "attention_mask must have shape (batch, sequence)."
            )

        if last_hidden_state.shape[:2] != attention_mask.shape:
            raise ValueError(
                "attention_mask must match the first two hidden-state "
                "dimensions."
            )

        if torch.any(attention_mask.sum(dim=1) == 0):
            raise ValueError(
                "Every passage needs at least one unmasked token."
            )

        expanded_mask = attention_mask.unsqueeze(-1).to(
            dtype=last_hidden_state.dtype
        )
        token_sum = (last_hidden_state * expanded_mask).sum(dim=1)
        token_count = expanded_mask.sum(dim=1)
        return token_sum / token_count

    @staticmethod
    def symmetric_comparison_features(
        first_embedding: Any,
        second_embedding: Any,
    ) -> Any:
        """Build the selected M1 ``[|A-B| ; A*B]`` feature vector."""
        AraT5SiameseVerifier._require_torch()

        if first_embedding.shape != second_embedding.shape:
            raise ValueError(
                "Siamese branch embeddings must have identical shapes."
            )

        if first_embedding.ndim != 2:
            raise ValueError(
                "Siamese branch embeddings must have shape (batch, hidden)."
            )

        return torch.cat(
            (
                torch.abs(first_embedding - second_embedding),
                first_embedding * second_embedding,
            ),
            dim=-1,
        )

    @staticmethod
    def _resolve_encoder_blocks(encoder: Any) -> tuple[Any, ...]:
        transformer = getattr(encoder, "encoder", None)
        blocks = getattr(transformer, "block", None)

        if blocks is None:
            raise ValueError(
                "Expected a T5-style encoder with encoder.block layers."
            )

        resolved = tuple(blocks)

        if not resolved:
            raise ValueError("The supplied encoder does not contain blocks.")

        return resolved

    @staticmethod
    def _resolve_hidden_size(encoder: Any) -> int:
        encoder_config = getattr(encoder, "config", None)
        hidden_size = getattr(encoder_config, "d_model", None)

        if not isinstance(hidden_size, int) or hidden_size < 1:
            raise ValueError(
                "Expected encoder.config.d_model to be a positive integer."
            )

        return hidden_size

    @staticmethod
    def _parameter_count(parameters: Any) -> int:
        return sum(parameter.numel() for parameter in parameters)

    @staticmethod
    def _require_torch() -> None:
        if torch is None or nn is None:
            raise ImportError(
                "PyTorch is required to build the AraT5 Siamese verifier."
            )
