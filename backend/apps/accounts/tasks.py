import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.db import models

from config.constants import ORCID_REFRESH_INTERVAL_DAYS, CELERY_TASK_MAX_RETRIES
from .models import Role, ReviewerProfile
from .services import ReviewerProfileService

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(
    bind=True,
    max_retries=CELERY_TASK_MAX_RETRIES,
    # TODO: Switch to exponential backoff via autoretry_for in Phase 7 hardening.
    # countdown is a flat retry delay for now.
    default_retry_delay=60,
)
def generate_reviewer_expertise_embedding(self, user_id: str):
    """
    Generate or refresh the expertise embedding for a single reviewer.
    Dispatched by the manual sync endpoint and the periodic beat task.
    """
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        logger.error(
            "generate_reviewer_expertise_embedding: User %s not found.", user_id
        )
        return

    if not user.has_role(Role.RoleName.REVIEWER):
        logger.warning(
            "generate_reviewer_expertise_embedding: User %s is not a reviewer — skipping.",
            user_id,
        )
        return

    try:
        ReviewerProfileService.sync_orcid_and_generate_embedding(user)
        logger.info(
            "Expertise embedding generated successfully for user %s.", user_id
        )
    except Exception as exc:
        logger.error(
            "generate_reviewer_expertise_embedding failed for user %s: %s",
            user_id,
            str(exc),
        )
        raise self.retry(exc=exc)


@shared_task(bind=True)
def refresh_all_reviewer_orcid_profiles(self):
    """
    Periodic beat task — runs daily at 2am.
    Dispatches generate_reviewer_expertise_embedding for each reviewer
    whose profile is stale (last_synced_at older than ORCID_REFRESH_INTERVAL_DAYS)
    or has never been synced.

    Each reviewer is processed as an independent async task —
    one failure does not block others.
    """
    stale_threshold = timezone.now() - timedelta(days=ORCID_REFRESH_INTERVAL_DAYS)

    reviewer_ids = (
        User.objects.filter(roles__name=Role.RoleName.REVIEWER)
        .filter(
            models.Q(reviewer_profile__last_synced_at__isnull=True)
            | models.Q(reviewer_profile__last_synced_at__lt=stale_threshold)
        )
        .values_list("id", flat=True)
    )

    count = 0
    for user_id in reviewer_ids:
        generate_reviewer_expertise_embedding.delay(str(user_id))
        count += 1

    logger.info(
        "refresh_all_reviewer_orcid_profiles: dispatched %d tasks.", count
    )