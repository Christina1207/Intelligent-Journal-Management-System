import pickle
from pathlib import Path

from plagiarism_core.retrieval.bm25_index import BM25Index


class BM25IndexDiskCache:
    """
    Persistent disk cache for BM25Index.

    This avoids rebuilding BM25 from Supabase every time we run retrieval.
    """

    def __init__(
        self,
        cache_dir: str | Path = "cache/bm25",
        cache_name: str = "default",
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_name = cache_name
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get_cache_path(
        self,
        language_filter: str | None,
        source_type: str | None,
        k1: float,
        b: float,
    ) -> Path:
        language_part = language_filter or "all"
        source_type_part = source_type or "all_sources"

        safe_source_type = source_type_part.replace("/", "_").replace("\\", "_")

        filename = (
            f"{self.cache_name}"
            f"__lang-{language_part}"
            f"__source-{safe_source_type}"
            f"__k1-{k1}"
            f"__b-{b}"
            ".pkl"
        )

        return self.cache_dir / filename

    def exists(
        self,
        language_filter: str | None,
        source_type: str | None,
        k1: float,
        b: float,
    ) -> bool:
        return self.get_cache_path(
            language_filter=language_filter,
            source_type=source_type,
            k1=k1,
            b=b,
        ).exists()

    def load(
        self,
        language_filter: str | None,
        source_type: str | None,
        k1: float,
        b: float,
    ) -> BM25Index | None:
        cache_path = self.get_cache_path(
            language_filter=language_filter,
            source_type=source_type,
            k1=k1,
            b=b,
        )

        if not cache_path.exists():
            return None

        with cache_path.open("rb") as file:
            index = pickle.load(file)

        if not isinstance(index, BM25Index):
            raise TypeError(
                f"Cache file does not contain BM25Index: {cache_path}"
            )

        return index

    def save(
        self,
        index: BM25Index,
        language_filter: str | None,
        source_type: str | None,
        k1: float,
        b: float,
    ) -> Path:
        cache_path = self.get_cache_path(
            language_filter=language_filter,
            source_type=source_type,
            k1=k1,
            b=b,
        )

        with cache_path.open("wb") as file:
            pickle.dump(index, file)

        return cache_path