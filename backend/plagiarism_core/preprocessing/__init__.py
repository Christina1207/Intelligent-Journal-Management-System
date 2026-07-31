from plagiarism_core.preprocessing.language_detector import detect_language
from plagiarism_core.preprocessing.normalizer import (
    normalize_arabic,
    normalize_english,
    normalize_text,
)
from plagiarism_core.preprocessing.preprocessor import Preprocessor
from plagiarism_core.preprocessing.segmenter import PassageSegmenter
from plagiarism_core.preprocessing.text_loader import load_text_file

__all__ = [
    "detect_language",
    "normalize_arabic",
    "normalize_english",
    "normalize_text",
    "Preprocessor",
    "PassageSegmenter",
    "load_text_file",
]