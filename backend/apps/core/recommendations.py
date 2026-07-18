import logging
from pgvector.django import CosineDistance
from django.db.models import Exists, OuterRef, Count, Q

from apps.accounts.models import Role, User, ReviewerProfile
from apps.reviews.models import Review
from apps.workflow.models import ReviewerAssignment
from config.constants import MAX_ACTIVE_REVIEWER_ASSIGNMENTS
from apps.reviews.eligibility import (
    ACTIVE_REVIEWER_ASSIGNMENT_STATUSES,
    reviewer_identity_conflict_q,
)

logger = logging.getLogger(__name__)


class RecommendationService:
    """
    Computes ranked reviewer recommendations for a submission
    using cosine similarity between submission abstract_embedding
    and reviewer expertise_embedding.

    Lives in apps/core to avoid circular dependencies — touches
    accounts, submissions, and reviews apps.
    """

    @staticmethod
    def get_recommendations(submission, limit: int) -> list[dict]:
        """
        Return ranked reviewer recommendations for the given submission.

        Exclusion rules applied:
        - Submission author excluded
        - Only REVIEWER role users
        - Only users with a computed expertise_embedding

        # TODO Sprint 4: exclude reviewers with active assignments on
        # the current version once reviewer application workflow is built.
        # TODO Sprint 4: exclude reviewers who have a conflict of interest
        # declaration against this submission.
        """
        if submission.abstract_embedding is None:
            logger.warning(
                "RecommendationService: submission %s has no abstract_embedding. "
                "Returning empty recommendations.",
                submission.id,
            )
            return []

        # Subquery: has this reviewer ever submitted a review for this journal?
        has_reviewed_before = Exists(
            Review.objects.filter(
                assignment__reviewer=OuterRef("user"),
            )
        )
        current_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        active_assignment_exists = (
            ReviewerAssignment.objects.filter(
                reviewer=OuterRef("user_id"),
                version__submission=submission,
                status__in=ACTIVE_REVIEWER_ASSIGNMENT_STATUSES,
            )
        )

        current_round_invitation_exists = (
            ReviewerAssignment.objects.filter(
                reviewer=OuterRef("user_id"),
                version=current_version,
            )
        )

        profiles = (
            ReviewerProfile.objects.annotate(
                similarity=1 - CosineDistance(
                    "expertise_embedding",
                    submission.abstract_embedding,
                ),
                has_reviewed_before=has_reviewed_before,
                has_active_assignment=Exists(
                    active_assignment_exists
                ),
                already_invited_current_round=Exists(
                    current_round_invitation_exists
                ),
                active_assignment_count=Count(
                    "user__reviewer_assignments",
                    filter=Q(
                        user__reviewer_assignments__status__in=(
                            ACTIVE_REVIEWER_ASSIGNMENT_STATUSES
                        )
                    ),
                    distinct=True,
                ),
            )
            .filter(
                sections=submission.section,
                user__status=User.Status.ACTIVE,
                user__roles__name=Role.RoleName.REVIEWER,
                expertise_embedding__isnull=False,
                has_active_assignment=False,
                already_invited_current_round=False,
                active_assignment_count__lt=MAX_ACTIVE_REVIEWER_ASSIGNMENTS,
            )
            .exclude(user=submission.author)
            .select_related("user")
        )
        conflict_query = reviewer_identity_conflict_q(
            submission=submission,
            email_field="user__email",
        )

        if conflict_query.children:
            profiles = profiles.exclude(conflict_query)

        profiles = (
            profiles
            .order_by(
                "-similarity",
                "active_assignment_count",
                "user__last_name",
            )
            .distinct()[:limit]
        )

        return [
            RecommendationService._serialize_profile(profile)
            for profile in profiles
        ]

    @staticmethod
    def _serialize_profile(profile) -> dict:
        user = profile.user
        biography_excerpt = ""
        if profile.biography:
            excerpt = profile.biography[:300]
            # Truncate at word boundary
            if len(profile.biography) > 300:
                excerpt = excerpt[: excerpt.rfind(" ")] + "..."
            biography_excerpt = excerpt

        return {
            "reviewer_id": str(user.id),
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email,
            "affiliation": user.affiliation,
            "keywords": profile.keywords,
            "biography_excerpt": biography_excerpt,
            "similarity_score": round(float(profile.similarity), 4),
            "has_reviewed_before": profile.has_reviewed_before,
            "active_assignment_count": profile.active_assignment_count,
        }