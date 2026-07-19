from django.utils import timezone

from apps.journals.models import JournalMetadataSettings
from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment
from config.constants import (
    MAX_REVISION_ROUNDS,
    REQUIRED_REVIEWS_COUNT,
)


class SubmissionPriorityService:
    """
    Calculate an explainable priority score for active submissions.

    The score supports editorial queue ordering only. It never makes
    acceptance, rejection, or reviewer-assignment decisions.
    """

    METHOD = "weighted_heuristic_v1"

    ACTION_URGENCY = {
        Submission.Status.REVIEWED: (
            100,
            "Completed reviews are awaiting an editorial decision.",
        ),
        Submission.Status.REVISED: (
            90,
            "A revised manuscript is awaiting the next review action.",
        ),
        Submission.Status.SUBMITTED: (
            85,
            "A new submission is awaiting initial editorial processing.",
        ),
        Submission.Status.ASSIGNED: (
            80,
            "The assigned editor should begin reviewer selection.",
        ),
        Submission.Status.SUSPENDED: (
            60,
            "The suspended case may require editorial resolution.",
        ),
        Submission.Status.UNDER_REVIEW: (
            30,
            "The manuscript is currently with reviewers.",
        ),
        Submission.Status.UNDER_REVISION: (
            20,
            "The manuscript is currently awaiting author revision.",
        ),
    }

    REVIEWER_COVERAGE_STATUSES = {
        Submission.Status.ASSIGNED,
        Submission.Status.UNDER_REVIEW,
        Submission.Status.REVISED,
    }

    @classmethod
    def calculate(
        cls,
        submission,
        *,
        journal_settings=None,
        now=None,
    ):
        """
        Return the score and a structured explanation for one submission.
        """
        journal_settings = (
            journal_settings
            or JournalMetadataSettings.get_current()
        )
        now = now or timezone.now()

        latest_version, assignments = (
            cls._latest_version_and_assignments(submission)
        )

        required_reviews = max(REQUIRED_REVIEWS_COUNT, 1)
        maximum_revision_rounds = max(MAX_REVISION_ROUNDS, 1)

        # --------------------------------------------------------------
        # Waiting age
        # --------------------------------------------------------------
        waiting_days = max(
            (now - submission.submitted_at).total_seconds()
            / 86400,
            0,
        )
        waiting_age_cap = max(
            journal_settings.priority_waiting_age_cap_days,
            1,
        )
        waiting_age_score = min(
            waiting_days / waiting_age_cap,
            1,
        ) * 100

        # --------------------------------------------------------------
        # Current-action urgency
        # --------------------------------------------------------------
        action_urgency_score, action_explanation = (
            cls.ACTION_URGENCY.get(
                submission.status,
                (0, "No active editorial action is identified."),
            )
        )

        # --------------------------------------------------------------
        # Reviewer shortage
        # --------------------------------------------------------------
        accepted_reviewers = sum(
            assignment.status
            == ReviewerAssignment.Status.ACCEPTED
            for assignment in assignments
        )

        if submission.status in cls.REVIEWER_COVERAGE_STATUSES:
            missing_reviewers = max(
                required_reviews - accepted_reviewers,
                0,
            )
            reviewer_shortage_score = (
                missing_reviewers / required_reviews
            ) * 100
            shortage_explanation = (
                f"{accepted_reviewers} of {required_reviews} "
                "required reviewers have accepted."
            )
        else:
            missing_reviewers = 0
            reviewer_shortage_score = 0
            shortage_explanation = (
                "Reviewer coverage is not an active requirement "
                "at this workflow stage."
            )

        # --------------------------------------------------------------
        # Overdue invitations and reviews
        # --------------------------------------------------------------
        overdue_invitations = sum(
            assignment.status
            == ReviewerAssignment.Status.PENDING
            and assignment.response_deadline < now
            for assignment in assignments
        )
        overdue_reviews = sum(
            assignment.status
            == ReviewerAssignment.Status.ACCEPTED
            and not hasattr(assignment, "review")
            and assignment.review_deadline < now
            for assignment in assignments
        )
        overdue_total = overdue_invitations + overdue_reviews
        overdue_work_score = min(
            overdue_total / required_reviews,
            1,
        ) * 100

        # --------------------------------------------------------------
        # Revision round
        # --------------------------------------------------------------
        revision_round = (
            max(latest_version.version_number - 1, 0)
            if latest_version
            else 0
        )
        revision_round_score = min(
            revision_round / maximum_revision_rounds,
            1,
        ) * 100

        factor_definitions = [
            {
                "key": "waiting_age",
                "label": "Waiting age",
                "score": waiting_age_score,
                "weight": (
                    journal_settings
                    .priority_waiting_age_weight
                ),
                "details": {
                    "waiting_days": round(waiting_days, 1),
                    "cap_days": waiting_age_cap,
                },
                "explanation": (
                    f"The manuscript has been in the journal workflow "
                    f"for {waiting_days:.1f} days."
                ),
            },
            {
                "key": "action_urgency",
                "label": "Action urgency",
                "score": action_urgency_score,
                "weight": (
                    journal_settings
                    .priority_action_urgency_weight
                ),
                "details": {
                    "status": submission.status,
                },
                "explanation": action_explanation,
            },
            {
                "key": "reviewer_shortage",
                "label": "Reviewer shortage",
                "score": reviewer_shortage_score,
                "weight": (
                    journal_settings
                    .priority_reviewer_shortage_weight
                ),
                "details": {
                    "accepted_reviewers": accepted_reviewers,
                    "required_reviews": required_reviews,
                    "missing_reviewers": missing_reviewers,
                },
                "explanation": shortage_explanation,
            },
            {
                "key": "overdue_work",
                "label": "Overdue work",
                "score": overdue_work_score,
                "weight": (
                    journal_settings
                    .priority_overdue_work_weight
                ),
                "details": {
                    "overdue_invitations": overdue_invitations,
                    "overdue_reviews": overdue_reviews,
                },
                "explanation": (
                    f"{overdue_invitations} overdue reviewer "
                    f"invitation(s) and {overdue_reviews} overdue "
                    "review(s)."
                ),
            },
            {
                "key": "revision_round",
                "label": "Revision round",
                "score": revision_round_score,
                "weight": (
                    journal_settings
                    .priority_revision_round_weight
                ),
                "details": {
                    "revision_round": revision_round,
                    "maximum_revision_rounds": (
                        maximum_revision_rounds
                    ),
                },
                "explanation": (
                    f"The manuscript is in revision round "
                    f"{revision_round}."
                ),
            },
        ]

        total_weight = sum(
            factor["weight"]
            for factor in factor_definitions
        )

        if total_weight <= 0:
            raise ValueError(
                "At least one priority-ranking weight must be positive."
            )

        factors = []

        for factor in factor_definitions:
            normalized_score = min(
                max(float(factor["score"]), 0),
                100,
            )
            contribution = (
                normalized_score
                * factor["weight"]
                / total_weight
            )

            factors.append(
                {
                    "key": factor["key"],
                    "label": factor["label"],
                    "score": round(normalized_score, 1),
                    "weight": factor["weight"],
                    "contribution": round(contribution, 1),
                    "details": factor["details"],
                    "explanation": factor["explanation"],
                }
            )

        return {
            "method": cls.METHOD,
            "score": round(
                sum(
                    factor["contribution"]
                    for factor in factors
                ),
                1,
            ),
            "factors": factors,
        }

    @classmethod
    def rank(
        cls,
        submissions,
        *,
        journal_settings=None,
        now=None,
    ):
        """
        Score and order submissions from highest to lowest priority.
        """
        journal_settings = (
            journal_settings
            or JournalMetadataSettings.get_current()
        )
        now = now or timezone.now()

        ranked = [
            {
                "submission": submission,
                "priority": cls.calculate(
                    submission,
                    journal_settings=journal_settings,
                    now=now,
                ),
            }
            for submission in submissions
        ]

        return sorted(
            ranked,
            key=lambda item: (
                -item["priority"]["score"],
                item["submission"].submitted_at,
                str(item["submission"].id),
            ),
        )

    @staticmethod
    def _latest_version_and_assignments(submission):
        """
        Support both normal access and the optimized prefetch that the
        analytics endpoint will add in the next step.
        """
        prefetched_versions = getattr(
            submission,
            "priority_versions",
            None,
        )

        if prefetched_versions is not None:
            latest_version = (
                prefetched_versions[0]
                if prefetched_versions
                else None
            )
        else:
            latest_version = (
                submission.versions
                .order_by("-version_number")
                .prefetch_related(
                    "reviewer_assignments__review"
                )
                .first()
            )

        if latest_version is None:
            return None, []

        prefetched_assignments = getattr(
            latest_version,
            "priority_assignments",
            None,
        )

        if prefetched_assignments is not None:
            assignments = prefetched_assignments
        else:
            assignments = list(
                latest_version.reviewer_assignments.all()
            )

        return latest_version, assignments