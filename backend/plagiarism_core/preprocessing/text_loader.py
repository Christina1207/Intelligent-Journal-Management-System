from pathlib import Path


SUPPORTED_TEXT_SUFFIXES = {".txt"}


class UnsupportedFileTypeError(Exception):
    pass


def load_text_file(file_path: str | Path) -> str:
    """
    Load a plain text document.

    This is enough for the first dataset experiments.
    Later we can add PDF extraction in another loader.
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    if path.suffix.lower() not in SUPPORTED_TEXT_SUFFIXES:
        raise UnsupportedFileTypeError(
            f"Unsupported file type: {path.suffix}. "
            "For now, only .txt files are supported."
        )

    encodings_to_try = [
        "utf-8",
        "utf-8-sig",
        "cp1256",
        "windows-1256",
    ]

    last_error: Exception | None = None

    for encoding in encodings_to_try:
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError as error:
            last_error = error

    raise UnicodeDecodeError(
        encoding="unknown",
        object=b"",
        start=0,
        end=1,
        reason=f"Could not decode file {path}. Last error: {last_error}",
    )