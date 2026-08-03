import re


ARABIC_LETTER_PATTERN = re.compile(r"[\u0600-\u06FF]")
ENGLISH_LETTER_PATTERN = re.compile(r"[A-Za-z]")


def detect_language(text: str) -> str:
    """
    Lightweight language detector.

    Returns:
    - "ar" if Arabic dominates
    - "en" if English dominates
    - "mixed" if both are present in meaningful amounts
    - "unknown" if no useful signal is found

    This is intentionally simple and dependency-free.
    """
    if text is None or not text.strip():
        return "unknown"

    arabic_count = len(ARABIC_LETTER_PATTERN.findall(text))
    english_count = len(ENGLISH_LETTER_PATTERN.findall(text))

    total = arabic_count + english_count

    if total == 0:
        return "unknown"

    arabic_ratio = arabic_count / total
    english_ratio = english_count / total

    if arabic_ratio >= 0.75:
        return "ar"

    if english_ratio >= 0.75:
        return "en"

    if arabic_count > 0 and english_count > 0:
        return "mixed"

    return "unknown"