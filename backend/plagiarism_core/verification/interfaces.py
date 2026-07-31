from typing import Protocol, Sequence, runtime_checkable

from plagiarism_core.schemas import (
    VerificationInput,
    VerificationResult,
)


@runtime_checkable
class PairVerifier(Protocol):
    """
    Stable boundary for Siamese and future cross-encoder implementations.

    Translation and candidate retrieval happen before this interface. A
    verifier receives prepared passage pairs and returns evidence for human
    review.
    """

    @property
    def model_name(self) -> str:
        """Return the model/checkpoint name used by the verifier."""
        ...

    @property
    def supported_representation_languages(self) -> frozenset[str]:
        """Return languages the verifier can process after preparation."""
        ...

    def verify_batch(
        self,
        inputs: Sequence[VerificationInput],
    ) -> list[VerificationResult]:
        """Score candidate pairs without making the editor's final decision."""
        ...
