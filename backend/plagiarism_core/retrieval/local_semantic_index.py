import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from plagiarism_core.schemas import SourceSegmentRecord
from plagiarism_core.storage import PostgresSourceRepository


class LocalSemanticIndex:
    """
    Exact local semantic search over cached source embeddings.

    The source embedding matrix is stored in a NumPy .npy file.
    Segment metadata is stored separately as JSON.

    Query embeddings and source embeddings are L2-normalized, so:

        cosine_similarity = source_matrix @ query_vector
    """

    def __init__(
        self,
        cache_dir: str | Path = "cache/semantic",
        cache_name: str = "exara_training_source",
        expected_source_type: str | None = None,
        expected_model_name: str | None = None,
        expected_embedding_dimension: int | None = None,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_name = cache_name
        self.expected_source_type = expected_source_type
        self.expected_model_name = expected_model_name
        self.expected_embedding_dimension = (
            expected_embedding_dimension
        )
        self.embeddings_path = (
            self.cache_dir
            / f"{cache_name}_embeddings.npy"
        )

        self.metadata_path = (
            self.cache_dir
            / f"{cache_name}_metadata.json"
        )

        self.manifest_path = (
            self.cache_dir
            / f"{cache_name}_manifest.json"
        )

        self._validate_cache_files()

        # mmap_mode="r" avoids loading the full matrix eagerly.
        self.embeddings = np.load(
            self.embeddings_path,
            mmap_mode="r",
            allow_pickle=False,
        )

        with self.metadata_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            self.metadata: list[dict] = json.load(file)

        with self.manifest_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            self.manifest: dict = json.load(file)

        self._validate_loaded_cache()

        print(
            "Loaded local semantic index: "
            f"segments={self.embeddings.shape[0]}, "
            f"dimension={self.embeddings.shape[1]}",
            flush=True,
        )

    @classmethod
    def build(
        cls,
        repository: PostgresSourceRepository,
        source_type: str,
        cache_dir: str | Path = "cache/semantic",
        cache_name: str | None = None,
        language: str | None = None,
        model_name: str = "intfloat/multilingual-e5-base",
        page_size: int = 200,
        force: bool = False,
    ) -> dict:
        """
        Export source embeddings from PostgreSQL and build a local cache.
        """
        resolved_cache_name = cache_name or source_type
        resolved_cache_dir = Path(cache_dir)

        resolved_cache_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        embeddings_path = (
            resolved_cache_dir
            / f"{resolved_cache_name}_embeddings.npy"
        )

        metadata_path = (
            resolved_cache_dir
            / f"{resolved_cache_name}_metadata.json"
        )

        manifest_path = (
            resolved_cache_dir
            / f"{resolved_cache_name}_manifest.json"
        )

        existing_files = [
            path
            for path in (
                embeddings_path,
                metadata_path,
                manifest_path,
            )
            if path.exists()
        ]

        if existing_files and not force:
            raise FileExistsError(
                "Semantic cache already exists. "
                "Use force=True or --force to rebuild it. "
                f"Existing files: {existing_files}"
            )

        print(
            f"Exporting embeddings for source_type={source_type}...",
            flush=True,
        )

        records = repository.list_source_segments_with_embeddings(
            source_type=source_type,
            language=language,
            page_size=page_size,
        )

        if not records:
            raise RuntimeError(
                "No source segments with embeddings were found for "
                f"source_type={source_type!r}."
            )

        segments = [
            segment
            for segment, _ in records
        ]

        embedding_matrix = np.asarray(
            [
                embedding
                for _, embedding in records
            ],
            dtype=np.float32,
        )

        if embedding_matrix.ndim != 2:
            raise ValueError(
                "Expected a two-dimensional embedding matrix, "
                f"received shape={embedding_matrix.shape}."
            )

        # Normalize defensively even though E5 indexing already produced
        # normalized vectors.
        norms = np.linalg.norm(
            embedding_matrix,
            axis=1,
            keepdims=True,
        )

        if np.any(norms == 0):
            raise ValueError(
                "At least one source embedding has zero magnitude."
            )

        embedding_matrix = embedding_matrix / norms

        np.save(
            embeddings_path,
            embedding_matrix,
            allow_pickle=False,
        )

        metadata = [
            {
                "id": segment.id,
                "source_document_id": segment.source_document_id,
                "source_document_external_id": (
                    segment.source_document_external_id
                ),
                "segment_index": segment.segment_index,
                "text": segment.text,
                "normalized_text": segment.normalized_text,
                "language": segment.language,
                "start_offset": segment.start_offset,
                "end_offset": segment.end_offset,
                "token_count": segment.token_count,
                "char_count": segment.char_count,
            }
            for segment in segments
        ]

        with metadata_path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                metadata,
                file,
                ensure_ascii=False,
                indent=2,
            )

        manifest = {
            "cache_name": resolved_cache_name,
            "source_type": source_type,
            "language": language,
            "model_name": model_name,
            "segment_count": int(embedding_matrix.shape[0]),
            "embedding_dimension": int(
                embedding_matrix.shape[1]
            ),
            "embedding_dtype": str(embedding_matrix.dtype),
            "normalized": True,
            "created_at": datetime.now(
                timezone.utc
            ).isoformat(),
            "files": {
                "embeddings": embeddings_path.name,
                "metadata": metadata_path.name,
            },
        }

        with manifest_path.open(
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                manifest,
                file,
                ensure_ascii=False,
                indent=2,
            )

        print(
            "Local semantic cache created:",
            flush=True,
        )
        print(
            f"  Segments:  {manifest['segment_count']}",
            flush=True,
        )
        print(
            f"  Dimension: {manifest['embedding_dimension']}",
            flush=True,
        )
        print(
            f"  Embeddings: {embeddings_path.resolve()}",
            flush=True,
        )
        print(
            f"  Metadata:   {metadata_path.resolve()}",
            flush=True,
        )

        return manifest

    def search(
        self,
        query_embedding: list[float],
        limit: int = 10,
        language: str | None = None,
    ) -> list[tuple[SourceSegmentRecord, float]]:
        """
        Run exact cosine-similarity search locally.
        """
        if limit <= 0 or not query_embedding:
            return []

        query_vector = np.asarray(
            query_embedding,
            dtype=np.float32,
        )

        if query_vector.ndim != 1:
            raise ValueError(
                "Query embedding must be one-dimensional."
            )

        if query_vector.shape[0] != self.embeddings.shape[1]:
            raise ValueError(
                "Embedding dimension mismatch: "
                f"query={query_vector.shape[0]}, "
                f"index={self.embeddings.shape[1]}"
            )

        query_norm = np.linalg.norm(query_vector)

        if query_norm == 0:
            raise ValueError(
                "Query embedding has zero magnitude."
            )

        query_vector = query_vector / query_norm

        valid_indices: np.ndarray | None = None

        if language is not None and language != "mixed":
            valid_indices = np.asarray(
                [
                    index
                    for index, metadata in enumerate(self.metadata)
                    if metadata["language"] == language
                ],
                dtype=np.int64,
            )

            if valid_indices.size == 0:
                return []

            candidate_embeddings = self.embeddings[
                valid_indices
            ]
        else:
            candidate_embeddings = self.embeddings

        # Exact cosine similarity because both sides are normalized.
        scores = np.asarray(
            candidate_embeddings @ query_vector,
            dtype=np.float32,
        )

        top_count = min(limit, scores.size)

        if top_count == 0:
            return []

        if top_count == scores.size:
            top_positions = np.argsort(scores)[::-1]
        else:
            partition_start = scores.size - top_count

            top_positions = np.argpartition(
                scores,
                partition_start,
            )[partition_start:]

            top_positions = top_positions[
                np.argsort(scores[top_positions])[::-1]
            ]

        results: list[
            tuple[SourceSegmentRecord, float]
        ] = []

        for local_position in top_positions:
            if valid_indices is not None:
                metadata_index = int(
                    valid_indices[local_position]
                )
            else:
                metadata_index = int(local_position)

            metadata = self.metadata[metadata_index]

            segment = SourceSegmentRecord(
                id=metadata["id"],
                source_document_id=(
                    metadata["source_document_id"]
                ),
                source_document_external_id=(
                    metadata[
                        "source_document_external_id"
                    ]
                ),
                segment_index=metadata["segment_index"],
                text=metadata["text"],
                normalized_text=metadata["normalized_text"],
                language=metadata["language"],
                start_offset=metadata["start_offset"],
                end_offset=metadata["end_offset"],
                token_count=metadata["token_count"],
                char_count=metadata["char_count"],
            )

            results.append(
                (
                    segment,
                    float(scores[local_position]),
                )
            )

        return results

    def _validate_cache_files(self) -> None:
        missing = [
            path
            for path in (
                self.embeddings_path,
                self.metadata_path,
                self.manifest_path,
            )
            if not path.exists()
        ]

        if missing:
            raise FileNotFoundError(
                "Local semantic cache is incomplete. "
                f"Missing files: {missing}. "
                "Run: python -m "
                "runners.build_local_semantic_cache "
                "--split training"
            )

    def _validate_loaded_cache(self) -> None:
        if self.embeddings.ndim != 2:
            raise ValueError(
                "Cached embeddings must be a matrix."
            )

        if len(self.metadata) != self.embeddings.shape[0]:
            raise ValueError(
                "Metadata/embedding count mismatch: "
                f"metadata={len(self.metadata)}, "
                f"embeddings={self.embeddings.shape[0]}"
            )

        manifest_source_type = self.manifest.get(
            "source_type"
        )
        if (
            self.expected_source_type is not None
            and manifest_source_type
            != self.expected_source_type
        ):
            raise ValueError(
                "Semantic cache source_type mismatch: "
                f"expected={self.expected_source_type!r}, "
                f"actual={manifest_source_type!r}."
            )

        manifest_model_name = self.manifest.get(
            "model_name"
        )
        if (
            self.expected_model_name is not None
            and manifest_model_name
            != self.expected_model_name
        ):
            raise ValueError(
                "Semantic cache model mismatch: "
                f"expected={self.expected_model_name!r}, "
                f"actual={manifest_model_name!r}."
            )

        manifest_dimension = self.manifest.get(
            "embedding_dimension"
        )
        if not isinstance(manifest_dimension, int):
            raise ValueError(
                "Semantic cache manifest must contain an integer "
                "embedding_dimension."
            )

        actual_dimension = int(self.embeddings.shape[1])

        if manifest_dimension != actual_dimension:
            raise ValueError(
                "Manifest embedding dimension does not match "
                "the cached matrix: "
                f"manifest={manifest_dimension}, "
                f"matrix={actual_dimension}."
            )

        if (
            self.expected_embedding_dimension is not None
            and actual_dimension
            != self.expected_embedding_dimension
        ):
            raise ValueError(
                "Semantic cache embedding dimension mismatch: "
                f"expected={self.expected_embedding_dimension}, "
                f"actual={actual_dimension}."
            )