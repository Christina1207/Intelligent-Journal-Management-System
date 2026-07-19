from datetime import datetime, time
from statistics import median

from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.publishing.models import PublishedArticle
from apps.reviews.models import Review
from apps.submissions.models import (
    Submission,
    SubmissionTopic,
    SubmissionVersion,
)
from apps.workflow.prioritization import (
    SubmissionPriorityService,
)
from apps.workflow.selectors import (
    prioritizable_submissions,
)

from .models import JournalMetadataSettings, Section


class EditorialAnalyticsService:
    """
    Build journal-wide operational analytics for the EIC dashboard.
    """

    PERIOD_MONTHS = 12
    PRIORITY_QUEUE_LIMIT = 10

    @classmethod
    def get_dashboard(cls):
        now = timezone.now()
        journal_settings = JournalMetadataSettings.get_current()

        status_counts = cls._status_counts()
        total_submissions = sum(status_counts.values())

        accepted_count = status_counts.get(
            Submission.Status.ACCEPTED,
            0,
        )
        rejected_count = status_counts.get(
            Submission.Status.REJECTED,
            0,
        )
        finalized_count = accepted_count + rejected_count

        if finalized_count:
            acceptance_rate = round(
                accepted_count / finalized_count * 100,
                1,
            )
            rejection_rate = round(
                rejected_count / finalized_count * 100,
                1,
            )
        else:
            acceptance_rate = 0
            rejection_rate = 0

        published_articles = PublishedArticle.objects.filter(
            status=PublishedArticle.Status.PUBLISHED,
            published_at__isnull=False,
        )

        month_starts = cls._month_starts(
            now,
            cls.PERIOD_MONTHS,
        )

        ranked = SubmissionPriorityService.rank(
            prioritizable_submissions(),
            journal_settings=journal_settings,
            now=now,
        )

        overdue_work = cls._overdue_totals(ranked)

        return {
            "generated_at": now,
            "period_months": cls.PERIOD_MONTHS,
            "summary": {
                "total_submissions": total_submissions,
                "total_publications": (
                    published_articles.count()
                ),
                "accepted_count": accepted_count,
                "rejected_count": rejected_count,
                "acceptance_rate": acceptance_rate,
                "rejection_rate": rejection_rate,
                "median_decision_duration_days": (
                    cls._median_decision_duration()
                ),
                "median_review_duration_days": (
                    cls._median_review_duration()
                ),
            },
            "status_distribution": [
                {
                    "code": status_code,
                    "label": status_label,
                    "count": status_counts.get(
                        status_code,
                        0,
                    ),
                }
                for status_code, status_label
                in Submission.Status.choices
            ],
            "submissions_over_time": cls._monthly_counts(
                Submission.objects.all(),
                date_field="submitted_at",
                month_starts=month_starts,
            ),
            "publications_over_time": cls._monthly_counts(
                published_articles,
                date_field="published_at",
                month_starts=month_starts,
            ),
            "section_distribution": (
                cls._section_distribution()
            ),
            "topic_distribution": (
                cls._topic_distribution(
                    total_submissions=total_submissions,
                )
            ),
            "overdue_work": overdue_work,
            "priority_queue": [
                cls._priority_item(item)
                for item in ranked[
                    :cls.PRIORITY_QUEUE_LIMIT
                ]
            ],
            "duration_definitions": {
                "decision_duration": (
                    "Days from initial submission to the final "
                    "accepted or rejected decision."
                ),
                "review_duration": (
                    "Days from reviewer assignment to review "
                    "submission. This includes invitation response "
                    "time because a separate response timestamp is "
                    "not currently stored."
                ),
            },
        }

    @staticmethod
    def _status_counts():
        return {
            row["status"]: row["count"]
            for row in (
                Submission.objects
                .values("status")
                .annotate(count=Count("id"))
            )
        }

    @classmethod
    def _monthly_counts(
        cls,
        queryset,
        *,
        date_field,
        month_starts,
    ):
        start_month = month_starts[0]
        start_datetime = timezone.make_aware(
            datetime.combine(start_month, time.min),
            timezone.get_current_timezone(),
        )

        grouped = (
            queryset
            .filter(
                **{
                    f"{date_field}__gte": start_datetime,
                }
            )
            .values(
                month=TruncMonth(date_field),
            )
            .annotate(count=Count("id"))
            .order_by("month")
        )

        counts_by_month = {
            row["month"].date().replace(day=1): row["count"]
            for row in grouped
            if row["month"] is not None
        }

        return [
            {
                "month": month_start,
                "count": counts_by_month.get(
                    month_start,
                    0,
                ),
            }
            for month_start in month_starts
        ]

    @classmethod
    def _month_starts(cls, now, count):
        current_month = now.date().replace(day=1)

        return [
            cls._shift_month(
                current_month,
                offset,
            )
            for offset in range(
                -(count - 1),
                1,
            )
        ]

    @staticmethod
    def _shift_month(month_start, offset):
        absolute_month = (
            month_start.year * 12
            + month_start.month
            - 1
            + offset
        )

        year, zero_based_month = divmod(
            absolute_month,
            12,
        )

        return month_start.replace(
            year=year,
            month=zero_based_month + 1,
            day=1,
        )

    @staticmethod
    def _median_decision_duration():
        durations = []

        versions = (
            SubmissionVersion.objects
            .filter(
                decision__in=[
                    SubmissionVersion.Decision.ACCEPTED,
                    SubmissionVersion.Decision.REJECTED,
                ],
                decided_at__isnull=False,
                submission__status__in=[
                    Submission.Status.ACCEPTED,
                    Submission.Status.REJECTED,
                ],
            )
            .select_related("submission")
        )

        for version in versions:
            duration = (
                version.decided_at
                - version.submission.submitted_at
            ).total_seconds() / 86400

            if duration >= 0:
                durations.append(duration)

        if not durations:
            return None

        return round(median(durations), 1)

    @staticmethod
    def _median_review_duration():
        durations = []

        reviews = (
            Review.objects
            .select_related("assignment")
            .all()
        )

        for review in reviews:
            duration = (
                review.submitted_at
                - review.assignment.assigned_at
            ).total_seconds() / 86400

            if duration >= 0:
                durations.append(duration)

        if not durations:
            return None

        return round(median(durations), 1)

    @staticmethod
    def _section_distribution():
        return list(
            Section.objects
            .annotate(
                submission_count=Count("submissions"),
            )
            .values(
                "id",
                "name",
                "submission_count",
            )
            .order_by(
                "-submission_count",
                "name",
            )
        )

    @staticmethod
    def _topic_distribution(*, total_submissions):
        topics = list(
            SubmissionTopic.objects
            .exclude(label__isnull=True)
            .exclude(label="")
            .values("label")
            .annotate(
                submission_count=Count("id"),
            )
            .order_by(
                "-submission_count",
                "label",
            )
        )

        classified_count = sum(
            topic["submission_count"]
            for topic in topics
        )

        return {
            "topics": topics,
            "unclassified_count": max(
                total_submissions - classified_count,
                0,
            ),
        }

    @staticmethod
    def _overdue_totals(ranked):
        overdue_invitations = 0
        overdue_reviews = 0

        for item in ranked:
            overdue_factor = next(
                factor
                for factor in item["priority"]["factors"]
                if factor["key"] == "overdue_work"
            )

            overdue_invitations += (
                overdue_factor["details"][
                    "overdue_invitations"
                ]
            )
            overdue_reviews += (
                overdue_factor["details"][
                    "overdue_reviews"
                ]
            )

        return {
            "overdue_invitations": overdue_invitations,
            "overdue_reviews": overdue_reviews,
            "total": (
                overdue_invitations
                + overdue_reviews
            ),
        }

    @staticmethod
    def _priority_item(item):
        submission = item["submission"]
        priority = item["priority"]

        versions = getattr(
            submission,
            "priority_versions",
            [],
        )
        latest_version = versions[0] if versions else None

        editor = submission.assigned_editor

        if editor:
            editor_name = (
                f"{editor.first_name} "
                f"{editor.last_name}"
            ).strip()

            assigned_editor = {
                "id": editor.id,
                "full_name": (
                    editor_name or editor.username
                ),
            }
        else:
            assigned_editor = None

        return {
            "submission_id": submission.id,
            "title": submission.title,
            "status": submission.status,
            "section": {
                "id": submission.section.id,
                "name": submission.section.name,
            },
            "assigned_editor": assigned_editor,
            "submitted_at": submission.submitted_at,
            "latest_version_number": (
                latest_version.version_number
                if latest_version
                else None
            ),
            "method": priority["method"],
            "score": priority["score"],
            "factors": priority["factors"],
        }