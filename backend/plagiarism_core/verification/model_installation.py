from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from plagiarism_core.verification.local_pair_verifier import (
    DEFAULT_ENCODER_MODEL_ID,
    validate_local_arat5_directory,
)


LOCAL_MODEL_MANIFEST_SCHEMA = "local_arat5_installation_v1"


@dataclass(frozen=True)
class LocalAraT5Installation:
    """Description of a completed self-contained encoder installation."""

    schema_version: str
    model_id: str
    local_directory: str
    installed_at: str
    encoder_only: bool

    def to_dict(self) -> dict:
        return asdict(self)


def install_local_arat5(
    destination: str | Path = "models/AraT5v2-base-1024",
    *,
    model_id: str = DEFAULT_ENCODER_MODEL_ID,
) -> LocalAraT5Installation:
    """
    Download AraT5 once and save the encoder/tokenizer inside the project.

    An existing complete installation is reused. An incomplete destination is
    never overwritten automatically.
    """
    destination = Path(destination)
    if destination.exists():
        validate_local_arat5_directory(destination)
        return _read_or_build_manifest(destination, model_id=model_id)

    try:
        from transformers import AutoTokenizer, T5EncoderModel
    except ImportError as exc:
        raise ImportError(
            "transformers and sentencepiece are required to install AraT5."
        ) from exc

    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = destination.parent / (
        f".{destination.name}.install-{uuid4().hex}"
    )
    staging.mkdir(parents=False, exist_ok=False)

    try:
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        encoder = T5EncoderModel.from_pretrained(model_id)
        encoder.save_pretrained(staging, safe_serialization=True)
        tokenizer.save_pretrained(staging)

        installation = LocalAraT5Installation(
            schema_version=LOCAL_MODEL_MANIFEST_SCHEMA,
            model_id=model_id,
            local_directory=str(destination),
            installed_at=datetime.now(timezone.utc).isoformat(),
            encoder_only=True,
        )
        with (staging / "installation_manifest.json").open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                installation.to_dict(),
                file,
                ensure_ascii=False,
                indent=2,
            )
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())

        validate_local_arat5_directory(staging)
        os.replace(staging, destination)
        return installation
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def _read_or_build_manifest(
    destination: Path,
    *,
    model_id: str,
) -> LocalAraT5Installation:
    manifest_path = destination / "installation_manifest.json"
    if manifest_path.is_file():
        with manifest_path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        if payload.get("schema_version") == LOCAL_MODEL_MANIFEST_SCHEMA:
            return LocalAraT5Installation(
                schema_version=payload["schema_version"],
                model_id=str(payload["model_id"]),
                local_directory=str(destination),
                installed_at=str(payload["installed_at"]),
                encoder_only=bool(payload["encoder_only"]),
            )

    return LocalAraT5Installation(
        schema_version=LOCAL_MODEL_MANIFEST_SCHEMA,
        model_id=model_id,
        local_directory=str(destination),
        installed_at="unknown_existing_installation",
        encoder_only=True,
    )
