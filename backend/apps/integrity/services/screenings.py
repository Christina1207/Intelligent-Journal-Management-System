import logging
from dataclasses import dataclass
from functools import partial
from uuid import uuid4

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.integrity.models import PlagiarismScreening
from apps.submissions.models import Submission, SubmissionVersion


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScreeningRequestResult:
    screening: PlagiarismScreening
    created: bool


class ScreeningRequestError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _required_text_setting(name: str) -> str:
    value = getattr(settings, name, "")

    if not isinstance(value, str) or not value.strip():
        raise ScreeningRequestError(
            "PIPELINE_NOT_CONFIGURED",
            (
                "Plagiarism screening is not configured "
                "correctly."
            ),
        )

    return value.strip()


def _dispatch_screening(
    *,
    screening_id: str,
    task_id: str,
) -> None:
    """
    Publish a committed screening to Celery.

    Broker and dispatch errors are logged internally and recorded using a
    safe public message. They are not allowed to invalidate the already
    committed screening transaction.
    """
    try:
        from apps.integrity.tasks import (
            run_plagiarism_screening,
        )

        run_plagiarism_screening.apply_async(
            args=[screening_id],
            task_id=task_id,
        )
    except Exception:
        logger.exception(
            "Could not dispatch plagiarism screening %s.",
            screening_id,
        )

        now = timezone.now()

        PlagiarismScreening.objects.filter(
            id=screening_id,
            status=PlagiarismScreening.Status.QUEUED,
            celery_task_id=task_id,
        ).update(
            status=PlagiarismScreening.Status.FAILED,
            error_code="TASK_DISPATCH_FAILED",
            error_message=(
                "Plagiarism screening could not be queued. "
                "Please try again."
            ),
            completed_at=now,
            updated_at=now,
        )


@transaction.atomic
def request_plagiarism_screening(
    *,
    submission_version: SubmissionVersion,
    requested_by=None,
) -> ScreeningRequestResult:
    """
    Persist and dispatch one initial plagiarism screening.

    Locking the submission version serializes concurrent requests for the
    same manuscript version. The database partial unique constraint remains
    the final protection against duplicate active screenings.
    """
    if not settings.PLAGIARISM_ENABLED:
        raise ScreeningRequestError(
            "PLAGIARISM_DISABLED",
            "Plagiarism screening is currently disabled.",
        )

    source_type = _required_text_setting(
        "PLAGIARISM_SOURCE_TYPE"
    )
    pipeline_version = _required_text_setting(
        "PLAGIARISM_PIPELINE_VERSION"
    )
    checkpoint_id = _required_text_setting(
        "PLAGIARISM_CHECKPOINT_ID"
    )

    locked_version = (
        SubmissionVersion.objects
        .select_for_update()
        .select_related("submission")
        .get(pk=submission_version.pk)
    )

    submission = locked_version.submission

    if submission.status != Submission.Status.SUBMITTED:
        raise ScreeningRequestError(
            "SCREENING_NOT_ALLOWED",
            (
                "Initial plagiarism screening may only be "
                "requested while the submission is awaiting "
                "initial screening."
            ),
        )

    if submission.language != "ar":
        raise ScreeningRequestError(
            "UNSUPPORTED_LANGUAGE",
            (
                "The current plagiarism verifier supports "
                "Arabic submissions only."
            ),
        )

    if not locked_version.file:
        raise ScreeningRequestError(
            "MANUSCRIPT_MISSING",
            (
                "No full manuscript file is attached to this "
                "submission version."
            ),
        )

    active_screening = (
        PlagiarismScreening.objects
        .filter(
            submission_version=locked_version,
            status__in=[
                PlagiarismScreening.Status.QUEUED,
                PlagiarismScreening.Status.RUNNING,
            ],
        )
        .order_by("-created_at")
        .first()
    )

    if active_screening is not None:
        return ScreeningRequestResult(
            screening=active_screening,
            created=False,
        )

    task_id = str(uuid4())

    screening = PlagiarismScreening.objects.create(
        submission_version=locked_version,
        requested_by=requested_by,
        celery_task_id=task_id,
        source_type=source_type,
        pipeline_version=pipeline_version,
        checkpoint_id=checkpoint_id,
    )

    transaction.on_commit(
        partial(
            _dispatch_screening,
            screening_id=str(screening.id),
            task_id=task_id,
        )
    )

    return ScreeningRequestResult(
        screening=screening,
        created=True,
    )