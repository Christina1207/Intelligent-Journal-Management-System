from collections.abc import Iterator
from pathlib import Path
from typing import Any

try:
    import ijson
except ImportError:  # Keep online verifier imports independent of audit extras.
    ijson = None


class CandidateJsonError(ValueError):
    """Raised when the candidate JSON cannot satisfy the expected structure."""


class CandidateJsonReader:
    """
    Stream a nested candidate JSON file one document at a time.

    Only the current document is materialized. The complete multi-hundred-MB
    JSON file is never loaded into memory.
    """

    def __init__(self, candidate_path: str | Path) -> None:
        self.candidate_path = Path(candidate_path)

    def read_metadata(self) -> dict[str, Any]:
        """Read the small top-level metadata object in a separate pass."""
        self._require_ijson()
        self._validate_path()

        with self.candidate_path.open("rb") as file:
            metadata = next(ijson.items(file, "metadata"), None)

        if not isinstance(metadata, dict):
            raise CandidateJsonError(
                "Candidate JSON must contain a top-level metadata object."
            )

        return metadata

    def iter_documents(self) -> Iterator[dict[str, Any]]:
        """Yield each object from the top-level ``documents`` array."""
        self._require_ijson()
        self._validate_path()

        with self.candidate_path.open("rb") as file:
            found_document = False

            for document in ijson.items(file, "documents.item"):
                found_document = True

                if not isinstance(document, dict):
                    raise CandidateJsonError(
                        "Every item in documents must be a JSON object."
                    )

                yield document

            if not found_document:
                raise CandidateJsonError(
                    "Candidate JSON contains no objects under documents."
                )

    def _validate_path(self) -> None:
        if not self.candidate_path.exists():
            raise FileNotFoundError(
                f"Candidate JSON does not exist: {self.candidate_path}"
            )

        if not self.candidate_path.is_file():
            raise CandidateJsonError(
                f"Candidate JSON path is not a file: {self.candidate_path}"
            )

    @staticmethod
    def _require_ijson() -> None:
        if ijson is None:
            raise ImportError(
                "Candidate JSON streaming requires 'ijson'. "
                "Install the project requirements before running the "
                "verifier audit."
            )
