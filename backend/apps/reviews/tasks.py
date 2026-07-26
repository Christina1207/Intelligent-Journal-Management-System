import logging

from celery import shared_task

from apps.reviews.services import ReviewService


logger = logging.getLogger(__name__)


@shared_task
def expire_pending_reviewer_assignments():
    """
    Periodically expire reviewer invitations whose response deadlines
    have passed.
    """
    expired_count = (
        ReviewService.expire_overdue_pending_assignments()
    )

    logger.info(
        "expire_pending_reviewer_assignments: expired %d assignments.",
        expired_count,
    )

    return expired_count