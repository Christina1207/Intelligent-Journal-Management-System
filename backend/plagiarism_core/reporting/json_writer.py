from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Mapping

from plagiarism_core.reporting.models import ReportGenerationResult


class PlagiarismReportJsonWriter:
    """Persist a report atomically as readable UTF-8 JSON."""

    def write(
        self,
        report: ReportGenerationResult | Mapping[str, Any],
        output_path: str | Path,
        *,
        overwrite: bool = False,
    ) -> Path:
        output_path = Path(output_path)
        if output_path.exists() and not overwrite:
            raise FileExistsError(
                f"Report already exists: {output_path}. "
                "Use a new path or explicitly enable overwrite."
            )
        output_path.parent.mkdir(parents=True, exist_ok=True)

        payload = (
            report.to_dict()
            if isinstance(report, ReportGenerationResult)
            else dict(report)
        )
        temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
        temporary_path.unlink(missing_ok=True)
        try:
            with temporary_path.open("w", encoding="utf-8") as file:
                json.dump(payload, file, ensure_ascii=False, indent=2)
                file.write("\n")
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary_path, output_path)
        finally:
            temporary_path.unlink(missing_ok=True)
        return output_path.resolve()
