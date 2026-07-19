from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.journals.models import (
    JournalMetadataSettings,
    Section,
)
from apps.publishing.models import PublishedArticle
from apps.submissions.models import (
    Submission,
    SubmissionTopic,
    SubmissionVersion,
)


class EditorialAnalyticsDashboardApiTests(APITestCase):
    def setUp(self):
        self.roles = {}

        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(
                name=role_name,
            )
            self.roles[role_name] = role

        self.eic = self._create_user(
            "analytics-eic",
            Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.admin = self._create_user(
            "analytics-admin",
            Role.RoleName.ADMIN,
        )
        self.manager = self._create_user(
            "analytics-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.author = self._create_user(
            "analytics-author",
            Role.RoleName.AUTHOR,
        )

        self.section = Section.objects.create(
            name="Journal Analytics Section",
            manager=self.manager,
        )

        self.accepted = self._create_submission(
            title="Accepted analytics paper",
            status_value=Submission.Status.ACCEPTED,
            decision=SubmissionVersion.Decision.ACCEPTED,
        )
        self.rejected = self._create_submission(
            title="Rejected analytics paper",
            status_value=Submission.Status.REJECTED,
            decision=SubmissionVersion.Decision.REJECTED,
        )
        self.active = self._create_submission(
            title="Active priority paper",
            status_value=Submission.Status.SUBMITTED,
            decision=SubmissionVersion.Decision.PENDING,
        )

        SubmissionTopic.objects.create(
            submission=self.active,
            label="Editorial Analytics",
            keywords=["analytics", "publishing"],
        )

        PublishedArticle.objects.create(
            submission=self.accepted,
            source_version=self.accepted.versions.get(),
            section=self.section,
            title=self.accepted.title,
            slug="accepted-analytics-paper",
            status=PublishedArticle.Status.PUBLISHED,
            published_at=timezone.now(),
        )

        settings = JournalMetadataSettings.get_current()
        settings.priority_waiting_age_weight = 100
        settings.priority_action_urgency_weight = 0
        settings.priority_reviewer_shortage_weight = 0
        settings.priority_overdue_work_weight = 0
        settings.priority_revision_round_weight = 0
        settings.save()

        self.url = reverse(
            "editorial-analytics-dashboard"
        )

    def _create_user(self, username, role_name):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )
        user.roles.add(self.roles[role_name])
        return user

    def _create_submission(
        self,
        *,
        title,
        status_value,
        decision,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract=(
                "A sufficiently detailed abstract for the "
                "journal analytics dashboard."
            ),
            language="en",
            author=self.author,
            section=self.section,
            status=status_value,
        )

        SubmissionVersion.objects.create(
            submission=submission,
            version_number=1,
            decision=decision,
            decided_at=(
                timezone.now()
                if decision
                != SubmissionVersion.Decision.PENDING
                else None
            ),
            decided_by=(
                self.eic
                if decision
                != SubmissionVersion.Decision.PENDING
                else None
            ),
        )

        return submission

    def test_dashboard_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_section_manager_cannot_view_journal_wide_analytics(
        self,
    ):
        self.client.force_authenticate(self.manager)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_eic_and_admin_can_view_dashboard(self):
        for user in [self.eic, self.admin]:
            with self.subTest(user=user.username):
                self.client.force_authenticate(user)

                response = self.client.get(self.url)

                self.assertEqual(
                    response.status_code,
                    status.HTTP_200_OK,
                    response.data,
                )

    def test_dashboard_returns_expected_metrics(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        summary = response.data["summary"]

        self.assertEqual(summary["total_submissions"], 3)
        self.assertEqual(summary["total_publications"], 1)
        self.assertEqual(summary["accepted_count"], 1)
        self.assertEqual(summary["rejected_count"], 1)
        self.assertEqual(summary["acceptance_rate"], 50.0)
        self.assertEqual(summary["rejection_rate"], 50.0)

        self.assertEqual(
            len(response.data["submissions_over_time"]),
            12,
        )
        self.assertEqual(
            len(response.data["publications_over_time"]),
            12,
        )

        self.assertEqual(
            response.data["topic_distribution"]["topics"][0][
                "label"
            ],
            "Editorial Analytics",
        )

    def test_priority_queue_is_explainable_and_private(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
            response.data,
        )

        priority_queue = response.data["priority_queue"]

        self.assertEqual(len(priority_queue), 1)
        self.assertEqual(
            priority_queue[0]["submission_id"],
            str(self.active.id),
        )
        self.assertEqual(
            priority_queue[0]["method"],
            "weighted_heuristic_v1",
        )
        self.assertEqual(
            len(priority_queue[0]["factors"]),
            5,
        )

        serialized = str(response.data)

        self.assertNotIn(self.author.email, serialized)
        self.assertNotIn("comments_for_editor", serialized)