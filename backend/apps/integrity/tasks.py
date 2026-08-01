import logging
from dataclasses import dataclass

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from apps.integrity.models import PlagiarismScreening


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _FailureDetails:
    code: str
    message: str


class _ScreeningExecutionFailure(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.public_message = message


@transaction.atomic
def _claim_screening(
    screening_id: str,
    task_id: str,
) -> PlagiarismScreening | None:
    """
    Atomically claim queued work.

    A RUNNING screening owned by the same Celery task may resume after
    broker redelivery. Terminal or differently owned screenings are ignored.
    """
    try:
        screening = (
            PlagiarismScreening.objects
            .select_for_update()
            .select_related(
                "submission_version__submission",
            )
            .get(id=screening_id)
        )
    except PlagiarismScreening.DoesNotExist:
        logger.warning(
            "Plagiarism screening %s no longer exists.",
            screening_id,
        )
        return None

    if screening.status == PlagiarismScreening.Status.QUEUED:
        screening.status = PlagiarismScreening.Status.RUNNING
        screening.celery_task_id = task_id
        screening.started_at = timezone.now()
        screening.completed_at = None
        screening.error_code = ""
        screening.error_message = ""
        screening.save(
            update_fields=[
                "status",
                "celery_task_id",
                "started_at",
                "completed_at",
                "error_code",
                "error_message",
                "updated_at",
            ]
        )
        return screening

    if (
        screening.status
        == PlagiarismScreening.Status.RUNNING
        and screening.celery_task_id == task_id
    ):
        return screening

    logger.info(
        "Ignoring screening %s in status %s.",
        screening_id,
        screening.status,
    )
    return None


def _execute_screening(
    screening: PlagiarismScreening,
) -> dict:
    """
    Download the full manuscript and run the cached plagiarism checker.

    Heavy imports remain local so ordinary Django processes and the general
    Celery worker do not import the ML pipeline.
    """
    from minio.error import S3Error
    from urllib3.exceptions import HTTPError as Urllib3HTTPError

    from apps.core.storage import StorageService
    from apps.integrity.services.pipeline import (
        get_plagiarism_checker,
    )

    version = screening.submission_version
    submission = version.submission

    if not version.file:
        raise _ScreeningExecutionFailure(
            "MANUSCRIPT_MISSING",
            "No full manuscript file is attached to this version.",
        )

    if submission.language != "ar":
        raise _ScreeningExecutionFailure(
            "UNSUPPORTED_LANGUAGE",
            (
                "The current plagiarism verifier supports Arabic "
                "submissions only."
            ),
        )

    try:
        storage = StorageService()

        with storage.temporary_download(
            version.file,
            filename="manuscript.pdf",
        ) as local_path:
            checker = get_plagiarism_checker()
            result = checker.check_file(
                local_path,
                document_id=str(version.id),
                title=submission.title,
                language=submission.language,
                media_type="application/pdf",
                metadata={
                    "submission_id": str(submission.id),
                    "submission_version_id": str(version.id),
                    "version_number": version.version_number,
                },
            )
    except S3Error as exc:
        if exc.code in {"NoSuchKey", "NoSuchObject"}:
            raise _ScreeningExecutionFailure(
                "MANUSCRIPT_NOT_FOUND",
                (
                    "The manuscript file could not be found in "
                    "private storage."
                ),
            ) from exc

        raise _ScreeningExecutionFailure(
            "MANUSCRIPT_STORAGE_ERROR",
            (
                "The manuscript could not be downloaded from "
                "private storage."
            ),
        ) from exc
    except Urllib3HTTPError as exc:
        raise _ScreeningExecutionFailure(
            "MANUSCRIPT_STORAGE_ERROR",
            (
                "The manuscript could not be downloaded from "
                "private storage."
            ),
        ) from exc

    report = result.report

    if not isinstance(report, dict):
        raise RuntimeError(
            "The plagiarism pipeline returned a non-object report."
        )

    schema_version = report.get("schema_version")
    if not isinstance(schema_version, str) or not schema_version:
        raise RuntimeError(
            "The plagiarism report has no schema version."
        )

    if not isinstance(report.get("summary"), dict):
        raise RuntimeError(
            "The plagiarism report has no valid summary."
        )

    return report


def _failure_details(exc: Exception) -> _FailureDetails:
    from django.core.exceptions import ImproperlyConfigured
    from psycopg import Error as PsycopgError

    from plagiarism_core.ingestion.errors import (
        DocumentIngestionError,
        DocumentTooLargeError,
        EncryptedPdfError,
        InvalidDocumentError,
        PdfOcrRequiredError,
        UnsupportedDocumentTypeError,
    )

    if isinstance(exc, _ScreeningExecutionFailure):
        return _FailureDetails(
            code=exc.code,
            message=exc.public_message,
        )

    if isinstance(exc, DocumentTooLargeError):
        return _FailureDetails(
            code="MANUSCRIPT_TOO_LARGE",
            message=(
                "The manuscript exceeds the configured "
                "screening size limit."
            ),
        )

    if isinstance(exc, EncryptedPdfError):
        return _FailureDetails(
            code="ENCRYPTED_PDF",
            message=(
                "The manuscript PDF is encrypted and cannot "
                "be screened."
            ),
        )

    if isinstance(exc, PdfOcrRequiredError):
        return _FailureDetails(
            code="PDF_OCR_REQUIRED",
            message=(
                "The manuscript has no usable embedded text. "
                "An OCR-processed PDF is required."
            ),
        )

    if isinstance(exc, UnsupportedDocumentTypeError):
        return _FailureDetails(
            code="UNSUPPORTED_DOCUMENT_TYPE",
            message=(
                "The submitted manuscript type is not supported "
                "for plagiarism screening."
            ),
        )

    if isinstance(
        exc,
        (InvalidDocumentError, DocumentIngestionError),
    ):
        return _FailureDetails(
            code="INVALID_DOCUMENT",
            message=(
                "The manuscript could not be read as a valid "
                "screening document."
            ),
        )

    if isinstance(exc, ImproperlyConfigured):
        return _FailureDetails(
            code="PIPELINE_CONFIGURATION_ERROR",
            message=(
                "Plagiarism screening is not configured correctly."
            ),
        )

    if isinstance(exc, PsycopgError):
        return _FailureDetails(
            code="SOURCE_DATABASE_UNAVAILABLE",
            message=(
                "The plagiarism comparison corpus is currently "
                "unavailable."
            ),
        )

    if isinstance(exc, FileNotFoundError):
        return _FailureDetails(
            code="PIPELINE_RESOURCE_MISSING",
            message=(
                "A required plagiarism model or index resource "
                "is unavailable."
            ),
        )

    if isinstance(exc, ValueError):
        return _FailureDetails(
            code="PIPELINE_VALIDATION_ERROR",
            message=(
                "The plagiarism pipeline rejected its input or "
                "configured resources."
            ),
        )

    return _FailureDetails(
        code="PIPELINE_EXECUTION_ERROR",
        message=(
            "Plagiarism screening could not be completed because "
            "of an internal processing error."
        ),
    )


def _complete_screening(
    screening_id: str,
    task_id: str,
    report: dict,
) -> None:
    updated = PlagiarismScreening.objects.filter(
        id=screening_id,
        status=PlagiarismScreening.Status.RUNNING,
        celery_task_id=task_id,
    ).update(
        status=PlagiarismScreening.Status.COMPLETED,
        report_schema_version=report["schema_version"],
        summary=report["summary"],
        report=report,
        error_code="",
        error_message="",
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )

    if updated != 1:
        logger.warning(
            "Screening %s was not completed because ownership "
            "or status changed.",
            screening_id,
        )


def _fail_screening(
    screening_id: str,
    task_id: str,
    failure: _FailureDetails,
) -> None:
    updated = PlagiarismScreening.objects.filter(
        id=screening_id,
        status=PlagiarismScreening.Status.RUNNING,
        celery_task_id=task_id,
    ).update(
        status=PlagiarismScreening.Status.FAILED,
        error_code=failure.code,
        error_message=failure.message,
        completed_at=timezone.now(),
        updated_at=timezone.now(),
    )

    if updated != 1:
        logger.warning(
            "Screening %s failure was not recorded because "
            "ownership or status changed.",
            screening_id,
        )


@shared_task(
    bind=True,
    name="apps.integrity.tasks.run_plagiarism_screening",
    ignore_result=True,
    acks_late=True,
    reject_on_worker_lost=True,
)
def run_plagiarism_screening(
    self,
    screening_id: str,
) -> None:
    task_id = str(
        self.request.id or f"untracked-{screening_id}"
    )

    screening = _claim_screening(
        screening_id,
        task_id,
    )

    if screening is None:
        return

    try:
        report = _execute_screening(screening)
        _complete_screening(
            screening_id,
            task_id,
            report,
        )
    except Exception as exc:
        failure = _failure_details(exc)

        _fail_screening(
            screening_id,
            task_id,
            failure,
        )

        logger.exception(
            "Plagiarism screening %s failed with code %s.",
            screening_id,
            failure.code,
        )