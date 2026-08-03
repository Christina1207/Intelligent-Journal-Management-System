from functools import lru_cache
from typing import Any

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from plagiarism_core.ingestion import (
    DocumentIngestionConfig,
    DocumentIngestionService,
    FilePlagiarismChecker,
)
from plagiarism_core.pipeline.factory import (
    DefaultLocalPipelineConfig,
    build_default_local_pipeline,
)


def _required_setting(name: str) -> Any:
    value = getattr(settings, name, None)

    if value is None:
        raise ImproperlyConfigured(
            f"{name} must be configured when plagiarism detection is enabled."
        )

    if isinstance(value, str) and not value.strip():
        raise ImproperlyConfigured(
            f"{name} must be configured when plagiarism detection is enabled."
        )

    return value


@lru_cache(maxsize=1)
def get_plagiarism_checker() -> FilePlagiarismChecker:
    """
    Build and cache one plagiarism checker per worker process.

    This function must be called only by the dedicated plagiarism Celery
    worker. Importing this module does not load the E5 or AraT5 models; model
    loading happens on the first call and the resulting checker is reused.
    """
    if not settings.PLAGIARISM_ENABLED:
        raise ImproperlyConfigured(
            "Plagiarism detection is disabled. Set "
            "PLAGIARISM_ENABLED=True before building the checker."
        )

    source_type = _required_setting(
        "PLAGIARISM_SOURCE_TYPE"
    )
    _required_setting("PLAGIARISM_DATABASE_URL")

    pipeline = build_default_local_pipeline(
        DefaultLocalPipelineConfig(
            e5_model_directory=(
                settings.PLAGIARISM_E5_MODEL_DIRECTORY
            ),
            e5_device=settings.PLAGIARISM_E5_DEVICE,
            e5_batch_size=(
                settings.PLAGIARISM_E5_BATCH_SIZE
            ),
            base_model_directory=(
                settings.PLAGIARISM_ARAT5_MODEL_DIRECTORY
            ),
            checkpoint_path=(
                settings.PLAGIARISM_CHECKPOINT_PATH
            ),
            checkpoint_id=(
                settings.PLAGIARISM_CHECKPOINT_ID
            ),
            source_type=source_type,
            semantic_backend=(
                settings.PLAGIARISM_SEMANTIC_BACKEND
            ),
            semantic_cache_directory=(
                settings.PLAGIARISM_SEMANTIC_CACHE_DIRECTORY
            ),
            bm25_cache_directory=(
                settings.PLAGIARISM_BM25_CACHE_DIRECTORY
            ),
            lexical_top_k=(
                settings.PLAGIARISM_LEXICAL_TOP_K
            ),
            semantic_top_k=(
                settings.PLAGIARISM_SEMANTIC_TOP_K
            ),
            device=settings.PLAGIARISM_DEVICE,
            mixed_precision=(
                settings.PLAGIARISM_MIXED_PRECISION
            ),
            verifier_batch_size=(
                settings.PLAGIARISM_VERIFIER_BATCH_SIZE
            ),
            verifier_max_length=(
                settings.PLAGIARISM_VERIFIER_MAX_LENGTH
            ),
            force_rebuild_bm25_cache=(
                settings.PLAGIARISM_FORCE_REBUILD_BM25_CACHE
            ),
        )
    )

    ingestion_service = DocumentIngestionService(
        DocumentIngestionConfig(
            max_file_size_bytes=(
                settings.PLAGIARISM_MAX_FILE_SIZE_BYTES
            ),
            minimum_pdf_usable_characters=(
                settings
                .PLAGIARISM_MINIMUM_PDF_USABLE_CHARACTERS
            ),
            pdf_page_separator=(
                settings.PLAGIARISM_PDF_PAGE_SEPARATOR
            ),
        )
    )

    return FilePlagiarismChecker(
        pipeline,
        ingestion_service=ingestion_service,
    )