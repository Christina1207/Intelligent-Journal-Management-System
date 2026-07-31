from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from plagiarism_core.pipeline.candidate_adapter import (
    ProductionCandidateAdapter,
)
from plagiarism_core.pipeline.orchestrator import (
    InMemoryPlagiarismPipeline,
)
from plagiarism_core.pipeline.retrieval_adapter import (
    HybridCandidateRetriever,
)
from plagiarism_core.reporting import (
    PlagiarismReportBuilder,
    ReportGenerationConfig,
)
from plagiarism_core.verification.local_pair_verifier import (
    DEFAULT_CHECKPOINT_ID,
    DEFAULT_VERIFIER_EPOCH,
    DEFAULT_VERIFIER_THRESHOLD,
    LocalAraT5PairVerifier,
    LocalAraT5PairVerifierConfig,
)


@dataclass(frozen=True)
class DefaultLocalPipelineConfig:
    """Configuration for the local plagiarism-detection pipeline."""

    e5_model_directory: str | Path = (
        "models/multilingual-e5-base"
    )
    e5_device: str = "cpu"
    e5_batch_size: int = 4

    base_model_directory: str | Path = (
        "models/AraT5v2-base-1024"
    )
    checkpoint_path: str | Path = (
        "models/verifier/f2_x2_o1_c1/best_model.pt"
    )
    checkpoint_id: str = DEFAULT_CHECKPOINT_ID

    source_type: str = "exara_test_source"
    semantic_backend: str = "local"
    semantic_cache_directory: str | Path = "cache/semantic"
    bm25_cache_directory: str | Path = "cache/bm25"

    lexical_top_k: int = 10
    semantic_top_k: int = 10

    device: str = "auto"
    mixed_precision: str = "auto"
    verifier_batch_size: int = 8
    verifier_max_length: int = 512

    force_rebuild_bm25_cache: bool = False

    def __post_init__(self) -> None:
        if not self.source_type:
            raise ValueError("source_type cannot be empty.")

        if self.semantic_backend not in {"local", "pgvector"}:
            raise ValueError(
                "semantic_backend must be local or pgvector."
            )

        if self.lexical_top_k < 1:
            raise ValueError("lexical_top_k must be positive.")

        if self.semantic_top_k < 1:
            raise ValueError("semantic_top_k must be positive.")

        if self.e5_batch_size < 1:
            raise ValueError("e5_batch_size must be positive.")

        if self.verifier_batch_size < 1:
            raise ValueError(
                "verifier_batch_size must be positive."
            )

        if self.verifier_max_length < 1:
            raise ValueError(
                "verifier_max_length must be positive."
            )


def build_default_local_pipeline(
    config: DefaultLocalPipelineConfig | None = None,
) -> InMemoryPlagiarismPipeline:
    """
    Build the complete local plagiarism-detection pipeline.

    Imports are deliberately local so importing the package does not
    immediately initialize storage, retrieval indexes, or ML models.
    """
    resolved = config or DefaultLocalPipelineConfig()

    try:
        from plagiarism_core.embeddings import LocalE5Embedder
        from plagiarism_core.preprocessing import Preprocessor
        from plagiarism_core.retrieval import (
            BM25LexicalRetriever,
            CandidateMerger,
            SemanticRetriever,
        )
        from plagiarism_core.retrieval.local_semantic_index import (
            LocalSemanticIndex,
        )
        from plagiarism_core.storage import PostgresSourceRepository
    except ImportError as exc:
        raise ImportError(
            "The preprocessing, embeddings, retrieval, and storage "
            "packages from the complete plagiarism pipeline are required."
        ) from exc

    repository = PostgresSourceRepository()
    preprocessor = Preprocessor()

    lexical = BM25LexicalRetriever(
        repository=repository,
        candidate_pool_size=max(
            resolved.lexical_top_k * 2,
            20,
        ),
        final_top_k=resolved.lexical_top_k,
        min_final_score=0.05,
        source_type=resolved.source_type,
        use_disk_cache=True,
        cache_name=resolved.source_type,
        cache_dir=str(resolved.bm25_cache_directory),
        force_rebuild_cache=(
            resolved.force_rebuild_bm25_cache
        ),
    )

    embedder = LocalE5Embedder(
        model_path=str(resolved.e5_model_directory),
        device=resolved.e5_device,
        batch_size=resolved.e5_batch_size,
    )

    if resolved.semantic_backend == "local":
        local_index = LocalSemanticIndex(
            cache_dir=resolved.semantic_cache_directory,
            cache_name=resolved.source_type,
            expected_source_type=resolved.source_type,
            expected_model_name=embedder.model_name,
            expected_embedding_dimension=(
                embedder.embedding_dimension
            ),
        )
        semantic_repository = None
    else:
        local_index = None
        semantic_repository = repository

    semantic = SemanticRetriever(
        repository=semantic_repository,
        embedder=embedder,
        top_k=resolved.semantic_top_k,
        min_similarity_score=0.0,
        restrict_to_same_language=False,
        source_type=resolved.source_type,
        local_index=local_index,
    )

    verifier = LocalAraT5PairVerifier.load(
        LocalAraT5PairVerifierConfig(
            base_model_directory=(
                resolved.base_model_directory
            ),
            checkpoint_path=resolved.checkpoint_path,
            checkpoint_id=resolved.checkpoint_id,
            expected_epoch=DEFAULT_VERIFIER_EPOCH,
            expected_threshold=DEFAULT_VERIFIER_THRESHOLD,
            batch_size=resolved.verifier_batch_size,
            max_length=resolved.verifier_max_length,
            device=resolved.device,
            mixed_precision=resolved.mixed_precision,
        )
    )

    report_builder = PlagiarismReportBuilder(
        ReportGenerationConfig(
            lexical_top_k=resolved.lexical_top_k,
            semantic_top_k=resolved.semantic_top_k,
            verifier_threshold=(
                DEFAULT_VERIFIER_THRESHOLD
            ),
            verifier_checkpoint=resolved.checkpoint_id,
            verifier_model=verifier.model_name,
            verifier_epoch=DEFAULT_VERIFIER_EPOCH,
        )
    )

    return InMemoryPlagiarismPipeline(
        preprocessor=preprocessor,
        candidate_retriever=HybridCandidateRetriever(
            lexical_retriever=lexical,
            semantic_retriever=semantic,
            candidate_merger=CandidateMerger(),
        ),
        verifier=verifier,
        report_builder=report_builder,
        candidate_adapter=ProductionCandidateAdapter(
            source_document_resolver=(
                repository.get_source_document_by_id
            ),
        ),
    )