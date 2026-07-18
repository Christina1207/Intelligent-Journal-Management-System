import logging
from pgvector.django import CosineDistance
from django.db.models import Exists, OuterRef, Count, Q
from django.core.exceptions import ObjectDoesNotExist

from apps.accounts.models import Role, User, ReviewerProfile
from apps.reviews.models import Review
from apps.workflow.models import ReviewerAssignment
from config.constants import (
    MAX_ACTIVE_REVIEWER_ASSIGNMENTS,
    REVIEWER_RECOMMENDATION_KEYWORD_WEIGHT,
    REVIEWER_RECOMMENDATION_SEMANTIC_WEIGHT,
)
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

       
        candidate_pool_limit = max(limit * 3, limit)
        profiles = list(
            profiles
            .order_by(
                "-similarity",
                "active_assignment_count",
                "user__last_name",
            )
            .distinct()[:candidate_pool_limit]
        )

        author_keywords, topic_keywords = (
            RecommendationService._submission_keyword_sources(
                submission
            )
        )

        recommendations = [
            RecommendationService._serialize_profile(
                profile,
                author_keywords=author_keywords,
                topic_keywords=topic_keywords,
            )
            for profile in profiles
        ]

        return RecommendationService._rank_recommendations(
            recommendations,
            limit=limit,
        )

    @staticmethod
    def _submission_keyword_sources(
        submission,
    ) -> tuple[list[str], list[str]]:
        author_keywords = list(submission.keywords or [])

        try:
            topic_keywords = list(
                submission.topic.keywords or []
            )
        except ObjectDoesNotExist:
            topic_keywords = []

        return author_keywords, topic_keywords


    @staticmethod
    def _normalize_keyword_map(
        keywords,
    ) -> dict[str, str]:
        normalized = {}

        for raw_keyword in keywords:
            display_keyword = " ".join(
                str(raw_keyword).split()
            )

            if not display_keyword:
                continue

            normalized.setdefault(
                display_keyword.casefold(),
                display_keyword,
            )

        return normalized


    @staticmethod
    def _normalized_weights() -> tuple[float, float]:
        semantic_weight = max(
            0.0,
            REVIEWER_RECOMMENDATION_SEMANTIC_WEIGHT,
        )
        keyword_weight = max(
            0.0,
            REVIEWER_RECOMMENDATION_KEYWORD_WEIGHT,
        )
        total = semantic_weight + keyword_weight

        if total <= 0:
            return 1.0, 0.0

        return (
            semantic_weight / total,
            keyword_weight / total,
        )


    @staticmethod
    def _serialize_profile(
        profile,
        *,
        author_keywords,
        topic_keywords,
    ) -> dict:
        user = profile.user

        semantic_score = max(
            0.0,
            min(1.0, float(profile.similarity)),
        )

        author_keyword_map = (
            RecommendationService._normalize_keyword_map(
                author_keywords
            )
        )
        topic_keyword_map = (
            RecommendationService._normalize_keyword_map(
                topic_keywords
            )
        )
        reviewer_keyword_map = (
            RecommendationService._normalize_keyword_map(
                profile.keywords
            )
        )

        manuscript_keyword_map = {
            **topic_keyword_map,
            **author_keyword_map,
        }

        matched_keys = (
            set(manuscript_keyword_map)
            & set(reviewer_keyword_map)
        )

        matched_author_keywords = sorted(
            (
                author_keyword_map[key]
                for key in matched_keys
                if key in author_keyword_map
            ),
            key=str.casefold,
        )
        matched_topic_keywords = sorted(
            (
                topic_keyword_map[key]
                for key in matched_keys
                if key in topic_keyword_map
            ),
            key=str.casefold,
        )
        matched_keywords = sorted(
            (
                manuscript_keyword_map[key]
                for key in matched_keys
            ),
            key=str.casefold,
        )

        keyword_overlap_score = (
            len(matched_keys) / len(manuscript_keyword_map)
            if manuscript_keyword_map
            else 0.0
        )

        semantic_weight, keyword_weight = (
            RecommendationService._normalized_weights()
        )
        recommendation_score = (
            semantic_weight * semantic_score
            + keyword_weight * keyword_overlap_score
        )

        biography_excerpt = ""

        if profile.biography:
            biography_excerpt = profile.biography[:300]

            if len(profile.biography) > 300:
                last_space = biography_excerpt.rfind(" ")

                if last_space > 0:
                    biography_excerpt = (
                        biography_excerpt[:last_space]
                    )

                biography_excerpt += "..."

        explanation_parts = [
            (
                f"Score uses {semantic_weight:.0%} semantic similarity "
                f"and {keyword_weight:.0%} keyword coverage."
            ),
            f"Semantic similarity: {semantic_score:.0%}.",
            f"Keyword coverage: {keyword_overlap_score:.0%}.",
        ]

        if matched_author_keywords:
            explanation_parts.append(
                "Matched author keywords: "
                + ", ".join(matched_author_keywords)
                + "."
            )

        if matched_topic_keywords:
            explanation_parts.append(
                "Matched detected-topic keywords: "
                + ", ".join(matched_topic_keywords)
                + "."
            )

        if not matched_keywords:
            explanation_parts.append(
                "No exact normalized keyword phrases matched."
            )

        explanation_parts.append(
            f"Current workload: "
            f"{profile.active_assignment_count} active "
            f"assignment"
            f"{'' if profile.active_assignment_count == 1 else 's'}."
        )

        return {
            "reviewer_id": str(user.id),
            "full_name": (
                f"{user.first_name} {user.last_name}".strip()
                or user.username
            ),
            "email": user.email,
            "affiliation": user.affiliation,
            "keywords": profile.keywords,
            "biography_excerpt": biography_excerpt,
            # Keep the old field for backward compatibility.
            "similarity_score": round(semantic_score, 4),
            "keyword_overlap_score": round(
                keyword_overlap_score,
                4,
            ),
            "recommendation_score": round(
                recommendation_score,
                4,
            ),
            "matched_keywords": matched_keywords,
            "matched_author_keywords": (
                matched_author_keywords
            ),
            "matched_topic_keywords": (
                matched_topic_keywords
            ),
            "active_assignment_count": (
                profile.active_assignment_count
            ),
            "has_reviewed_before": (
                profile.has_reviewed_before
            ),
            "explanation": " ".join(explanation_parts),
        }


    @staticmethod
    def _rank_recommendations(
        recommendations,
        *,
        limit,
    ):
        return sorted(
            recommendations,
            key=lambda recommendation: (
                -recommendation["recommendation_score"],
                recommendation["active_assignment_count"],
                recommendation["full_name"].casefold(),
            ),
        )[:limit]