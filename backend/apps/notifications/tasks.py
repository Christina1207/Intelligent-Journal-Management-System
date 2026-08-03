import logging
from datetime import timedelta
from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.publishing.models import PublishedArticle
from apps.submissions.models import SubmissionVersion
from apps.workflow.models import (
    ReviewerAssignment,
    SubmissionAssignment,
)

from .services import (
    send_article_published,
    send_author_decision,
    send_editor_assignment,
    send_review_deadline_reminder,
    send_reviewer_invitation,
    send_revision_ready,
)


logger = logging.getLogger(__name__)


EMAIL_TASK_OPTIONS = {
    "autoretry_for": (SMTPException, OSError),
    "retry_backoff": 60,
    "retry_backoff_max": 600,
    "retry_jitter": True,
    "max_retries": 3,
}


@shared_task(**EMAIL_TASK_OPTIONS)
def send_reviewer_invitation_email(assignment_id):
    assignment = (
        ReviewerAssignment.objects
        .select_related(
            "reviewer",
            "version",
            "version__submission",
            "version__submission__section",
        )
        .filter(pk=assignment_id)
        .first()
    )

    if assignment is None:
        logger.warning(
            "Reviewer invitation email skipped: assignment %s "
            "does not exist.",
            assignment_id,
        )
        return False

    return send_reviewer_invitation(assignment)


@shared_task(**EMAIL_TASK_OPTIONS)
def send_editor_assignment_email(assignment_id):
    assignment = (
        SubmissionAssignment.objects
        .select_related(
            "assigned_to",
            "submission",
            "submission__section",
        )
        .filter(pk=assignment_id)
        .first()
    )

    if assignment is None:
        logger.warning(
            "Editor assignment email skipped: assignment %s "
            "does not exist.",
            assignment_id,
        )
        return False

    return send_editor_assignment(assignment)


@shared_task(**EMAIL_TASK_OPTIONS)
def send_author_decision_email(
    version_id,
    desk_rejection=False,
):
    version = (
        SubmissionVersion.objects
        .select_related(
            "submission",
            "submission__author",
        )
        .filter(pk=version_id)
        .first()
    )

    if version is None:
        logger.warning(
            "Author decision email skipped: version %s "
            "does not exist.",
            version_id,
        )
        return False

    return send_author_decision(
        version,
        desk_rejection=desk_rejection,
    )


@shared_task(**EMAIL_TASK_OPTIONS)
def send_revision_ready_email(assignment_id):
    assignment = (
        ReviewerAssignment.objects
        .select_related(
            "reviewer",
            "version",
            "version__submission",
            "version__submission__section",
        )
        .filter(pk=assignment_id)
        .first()
    )

    if assignment is None:
        logger.warning(
            "Revision email skipped: assignment %s does not exist.",
            assignment_id,
        )
        return False

    return send_revision_ready(assignment)


@shared_task(**EMAIL_TASK_OPTIONS)
def send_article_published_email(article_id):
    article = (
        PublishedArticle.objects
        .select_related(
            "submission",
            "submission__author",
            "section",
        )
        .filter(pk=article_id)
        .first()
    )

    if article is None:
        logger.warning(
            "Publication email skipped: article %s does not exist.",
            article_id,
        )
        return False

    return send_article_published(article)


@shared_task
def dispatch_review_deadline_reminders():
    reminder_days = settings.REVIEW_DEADLINE_REMINDER_DAYS

    if reminder_days <= 0:
        logger.info(
            "Review deadline reminders are disabled."
        )
        return 0

    now = timezone.now()
    reminder_limit = now + timedelta(days=reminder_days)

    assignment_ids = list(
        ReviewerAssignment.objects.filter(
            status=ReviewerAssignment.Status.ACCEPTED,
            review__isnull=True,
            review_reminder_sent_at__isnull=True,
            review_deadline__gte=now,
            review_deadline__lte=reminder_limit,
        ).values_list("id", flat=True)
    )

    for assignment_id in assignment_ids:
        send_review_deadline_reminder_email.delay(
            str(assignment_id)
        )

    logger.info(
        "Queued %d review deadline reminder(s).",
        len(assignment_ids),
    )

    return len(assignment_ids)


@shared_task(**EMAIL_TASK_OPTIONS)
def send_review_deadline_reminder_email(assignment_id):
    reminder_days = settings.REVIEW_DEADLINE_REMINDER_DAYS

    if reminder_days <= 0:
        return False

    now = timezone.now()
    reminder_limit = now + timedelta(days=reminder_days)

    assignment = (
        ReviewerAssignment.objects
        .select_related(
            "reviewer",
            "version",
            "version__submission",
            "version__submission__section",
        )
        .filter(
            pk=assignment_id,
            status=ReviewerAssignment.Status.ACCEPTED,
            review__isnull=True,
            review_reminder_sent_at__isnull=True,
            review_deadline__gte=now,
            review_deadline__lte=reminder_limit,
        )
        .first()
    )

    if assignment is None:
        return False

    sent = send_review_deadline_reminder(assignment)

    if not sent:
        return False

    updated_count = (
        ReviewerAssignment.objects.filter(
            pk=assignment.pk,
            review_reminder_sent_at__isnull=True,
        ).update(
            review_reminder_sent_at=timezone.now(),
        )
    )

    return updated_count == 1