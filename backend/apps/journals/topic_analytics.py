from collections import Counter
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Prefetch
from django.utils import timezone

from apps.accounts.models import Role
from apps.submissions.models import Submission

from .models import Section


class TopicAnalyticsService:
    TOP_TOPIC_KEYWORDS = 5
    TOP_AUTHOR_KEYWORDS = 10

    @classmethod
    def get_dashboard(cls, user) -> dict:
        sections = cls._sections_for(user)

        return {
            "generated_at": timezone.now(),
            "sections": [
                cls._build_section_aggregate(section)
                for section in sections
            ],
        }

    @staticmethod
    def _sections_for(user):
        submissions = (
            Submission.objects
            .only(
                "id",
                "section_id",
                "keywords",
            )
            .select_related("topic")
        )

        queryset = (
            Section.objects
            .filter(is_active=True)
            .prefetch_related(
                Prefetch(
                    "submissions",
                    queryset=submissions,
                    to_attr="analytics_submissions",
                )
            )
            .order_by("name")
        )

        if user.is_superuser:
            return queryset

        role_names = set(
            user.roles.values_list("name", flat=True)
        )

        if (
            Role.RoleName.EDITOR_IN_CHIEF in role_names
            or Role.RoleName.ADMIN in role_names
        ):
            return queryset

        if Role.RoleName.SECTION_MANAGER in role_names:
            return queryset.filter(manager=user)

        return queryset.none()

    @classmethod
    def _build_section_aggregate(
        cls,
        section,
    ) -> dict:
        submissions = section.analytics_submissions
        total_submissions = len(submissions)

        analyzed_submissions = 0
        clustered_submissions = 0
        outlier_submissions = 0

        topic_groups = {}
        author_keyword_counts = Counter()
        author_keyword_display = {}

        for submission in submissions:
            cls._count_submission_keywords(
                submission.keywords,
                counts=author_keyword_counts,
                display_names=author_keyword_display,
            )

            try:
                topic = submission.topic
            except ObjectDoesNotExist:
                continue

            analyzed_submissions += 1

            label = (topic.label or "").strip()

            if not label:
                outlier_submissions += 1
                continue

            clustered_submissions += 1

            group = topic_groups.setdefault(
                label,
                {
                    "submission_count": 0,
                    "keyword_counts": Counter(),
                    "keyword_display": {},
                },
            )
            group["submission_count"] += 1

            cls._count_submission_keywords(
                topic.keywords,
                counts=group["keyword_counts"],
                display_names=group["keyword_display"],
            )

        pending_analysis = (
            total_submissions - analyzed_submissions
        )

        topics = []

        for label, group in topic_groups.items():
            submission_count = group["submission_count"]

            percentage = (
                submission_count
                / clustered_submissions
                * 100
                if clustered_submissions
                else 0
            )

            topics.append(
                {
                    "label": label,
                    "submission_count": submission_count,
                    "percentage_of_clustered": round(
                        percentage,
                        1,
                    ),
                    "keywords": cls._top_keywords(
                        group["keyword_counts"],
                        group["keyword_display"],
                        limit=cls.TOP_TOPIC_KEYWORDS,
                    ),
                }
            )

        topics.sort(
            key=lambda topic: (
                -topic["submission_count"],
                topic["label"].casefold(),
            )
        )

        if section.last_clustered_at is None:
            analysis_status = "not_started"
        elif pending_analysis > 0:
            analysis_status = "partial"
        else:
            analysis_status = "complete"

        return {
            "section": {
                "id": str(section.id),
                "name": section.name,
                "slug": section.slug,
            },
            "analysis_status": analysis_status,
            "last_clustered_at": (
                section.last_clustered_at
            ),
            "total_submissions": total_submissions,
            "analyzed_submissions": analyzed_submissions,
            "clustered_submissions": clustered_submissions,
            "outlier_submissions": outlier_submissions,
            "pending_analysis": pending_analysis,
            "topics": topics,
            "top_author_keywords": cls._top_keywords(
                author_keyword_counts,
                author_keyword_display,
                limit=cls.TOP_AUTHOR_KEYWORDS,
                include_count=True,
            ),
        }

    @staticmethod
    def _count_submission_keywords(
        keywords,
        *,
        counts,
        display_names,
    ):
        """
        Count each normalized keyword at most once per submission.

        This prevents accidental duplicate metadata from inflating an
        aggregate.
        """
        submission_keywords = {}

        for raw_keyword in keywords or []:
            display_keyword = " ".join(
                str(raw_keyword).split()
            )

            if not display_keyword:
                continue

            normalized = display_keyword.casefold()

            submission_keywords.setdefault(
                normalized,
                display_keyword,
            )

        for normalized, display_keyword in (
            submission_keywords.items()
        ):
            counts[normalized] += 1
            display_names.setdefault(
                normalized,
                display_keyword,
            )

    @staticmethod
    def _top_keywords(
        counts,
        display_names,
        *,
        limit,
        include_count=False,
    ):
        ordered = sorted(
            counts.items(),
            key=lambda item: (
                -item[1],
                display_names[item[0]].casefold(),
            ),
        )[:limit]

        if include_count:
            return [
                {
                    "keyword": display_names[key],
                    "submission_count": count,
                }
                for key, count in ordered
            ]

        return [
            display_names[key]
            for key, _count in ordered
        ]