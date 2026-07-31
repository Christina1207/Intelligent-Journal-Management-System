import re

from plagiarism_core.schemas import PreprocessingConfig


ARABIC_DIACRITICS_PATTERN = re.compile(
    r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]"
)

TATWEEL = "\u0640"


ARABIC_CHAR_MAP = {
    "أ": "ا",
    "إ": "ا",
    "آ": "ا",
    "ٱ": "ا",
    "ى": "ي",
}


PUNCTUATION_MAP = {
    "،": ",",
    "؛": ";",
    "؟": "?",
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "…": "...",
}


def normalize_whitespace(text: str) -> str:
    """
    Convert repeated whitespace into a single space.
    """
    return re.sub(r"\s+", " ", text).strip()


def normalize_arabic(text: str, config: PreprocessingConfig | None = None) -> str:
    """
    Light Arabic normalization.

    We intentionally do not remove:
    - numbers
    - English terms inside Arabic text
    - technical expressions
    - all punctuation

    This is important because these may be useful plagiarism evidence.
    """
    if text is None:
        return ""

    config = config or PreprocessingConfig()
    normalized = text

    if config.remove_diacritics:
        normalized = ARABIC_DIACRITICS_PATTERN.sub("", normalized)

    if config.remove_tatweel:
        normalized = normalized.replace(TATWEEL, "")

    for source_char, target_char in ARABIC_CHAR_MAP.items():
        normalized = normalized.replace(source_char, target_char)

    if config.normalize_punctuation:
        for source_punct, target_punct in PUNCTUATION_MAP.items():
            normalized = normalized.replace(source_punct, target_punct)

    if config.normalize_whitespace:
        normalized = normalize_whitespace(normalized)

    return normalized.strip()


def normalize_english(text: str, config: PreprocessingConfig | None = None) -> str:
    """
    Simple English normalization for future English source documents.
    """
    if text is None:
        return ""

    config = config or PreprocessingConfig()
    normalized = text

    if config.lowercase_english:
        normalized = normalized.lower()

    if config.normalize_punctuation:
        for source_punct, target_punct in PUNCTUATION_MAP.items():
            normalized = normalized.replace(source_punct, target_punct)

    if config.normalize_whitespace:
        normalized = normalize_whitespace(normalized)

    return normalized.strip()


def normalize_text(
    text: str,
    language: str,
    config: PreprocessingConfig | None = None,
) -> str:
    """
    Main normalization entry point.
    """
    if language == "ar":
        return normalize_arabic(text, config)

    if language == "en":
        return normalize_english(text, config)

    if language == "mixed":
        # Arabic normalization is safe for mixed Arabic-English text
        # because it does not remove English words or numbers.
        return normalize_arabic(text, config)

    return normalize_whitespace(text or "")