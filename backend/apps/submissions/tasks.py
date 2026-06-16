import logging
import pdfplumber
from celery import shared_task
from django.core.files.storage import default_storage

from config.constants import CELERY_TASK_MAX_RETRIES
from apps.core.embeddings import EmbeddingService

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=CELERY_TASK_MAX_RETRIES,
    default_retry_delay=60,
    # TODO Phase 7: replace default_retry_delay with exponential backoff
    # using autoretry_for and retry_backoff=True
)
def generate_submission_embedding(self, submission_id: str):
    """
    Extract text from the v1 PDF and generate abstract_embedding.
    Triggered once on initial submission — embedding is used for
    reviewer matching and does not change across revision rounds.
    Falls back to abstract-only embedding if PDF extraction fails.
    """
    from apps.submissions.models import Submission, SubmissionVersion

    try:
        submission = Submission.objects.select_related().get(id=submission_id)
    except Submission.DoesNotExist:
        logger.error(
            "generate_submission_embedding: Submission %s not found.", submission_id
        )
        return

    # Get v1 — embedding is always based on initial version
    try:
        version = submission.versions.get(version_number=1)
    except SubmissionVersion.DoesNotExist:
        logger.error(
            "generate_submission_embedding: No v1 found for submission %s.",
            submission_id,
        )
        return

    texts = []

    # Attempt PDF text extraction
    if version.file:
        try:
            from apps.core.storage import StorageService
            storage = StorageService()
            # Download PDF bytes from MinIO for pdfplumber
            import io
            from minio import Minio
            from django.conf import settings

            client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_USE_SSL,
            )
            response = client.get_object(settings.MINIO_BUCKET_NAME, version.file)
            pdf_bytes = response.read()
            response.close()

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pdf_text = " ".join(
                    page.extract_text() or "" for page in pdf.pages
                ).strip()

            if pdf_text:
                texts.append(pdf_text)
                logger.info(
                    "PDF text extracted for submission %s (%d chars).",
                    submission_id, len(pdf_text),
                )
            else:
                logger.warning(
                    "PDF extraction returned empty text for submission %s — "
                    "falling back to abstract.",
                    submission_id,
                )
        except Exception as e:
            logger.error(
                "PDF extraction failed for submission %s: %s — "
                "falling back to abstract.",
                submission_id, str(e),
            )

    # Always include abstract as fallback or supplement
    if submission.abstract:
        texts.append(submission.abstract)

    if not texts:
        logger.error(
            "generate_submission_embedding: No text available for submission %s.",
            submission_id,
        )
        return

    try:
        embedding = EmbeddingService.generate_combined(texts)
        Submission.objects.filter(id=submission_id).update(
            abstract_embedding=embedding
        )
        logger.info(
            "abstract_embedding stored for submission %s.", submission_id
        )
    except Exception as exc:
        logger.error(
            "Embedding generation failed for submission %s: %s",
            submission_id, str(exc),
        )
        raise self.retry(exc=exc)