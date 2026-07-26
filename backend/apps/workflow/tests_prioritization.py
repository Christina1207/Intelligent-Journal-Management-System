from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.journals.models import (
    JournalMetadataSettings,
    Section,
)
from apps.submissions.models import (
    Submission,
    SubmissionVersion,
)
from apps.workflow.models import ReviewerAssignment
from apps.workflow.prioritization import (
    SubmissionPriorityService,
)


class SubmissionPriorityServiceTests(TestCase):
    def setUp(self):
        self.now = timezone.now()

        self.author = self._create_user("priority-author")
        self.editor = self._create_user("priority-editor")
        self.section = Section.objects.create(
            name="Priority Test Section",
        )
        self.journal_settings = (
            JournalMetadataSettings.get_current()
        )

    def _create_user(self, username):
        return get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )

    def _create_submission(
        self,
        *,
        title,
        status,
        age_days,
        version_number=1,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract=(
                "A sufficiently detailed abstract for priority "
                "scoring tests."
            ),
            language="en",
            author=self.author,
            section=self.section,
            status=status,
        )

        Submission.objects.filter(
            pk=submission.pk,
        ).update(
            submitted_at=(
                self.now - timedelta(days=age_days)
            )
        )
        submission.refresh_from_db()

        SubmissionVersion.objects.create(
            submission=submission,
            version_number=version_number,
        )

        return submission

    def _set_weights(
        self,
        *,
        waiting=0,
        urgency=0,
        shortage=0,
        overdue=0,
        revision=0,
        waiting_cap=30,
    ):
        settings = self.journal_settings
        settings.priority_waiting_age_cap_days = waiting_cap
        settings.priority_waiting_age_weight = waiting
        settings.priority_action_urgency_weight = urgency
        settings.priority_reviewer_shortage_weight = shortage
        settings.priority_overdue_work_weight = overdue
        settings.priority_revision_round_weight = revision
        settings.save()

    def test_waiting_age_is_normalized_by_configured_cap(self):
        self._set_weights(
            waiting=100,
            waiting_cap=20,
        )

        submission = self._create_submission(
            title="Ten day submission",
            status=Submission.Status.SUBMITTED,
            age_days=10,
        )

        result = SubmissionPriorityService.calculate(
            submission,
            journal_settings=self.journal_settings,
            now=self.now,
        )

        self.assertEqual(result["score"], 50.0)

        waiting_factor = next(
            factor
            for factor in result["factors"]
            if factor["key"] == "waiting_age"
        )

        self.assertEqual(waiting_factor["score"], 50.0)
        self.assertEqual(
            waiting_factor["details"]["waiting_days"],
            10.0,
        )

    def test_overdue_invitations_and_reviews_are_explained(self):
        self._set_weights(
            shortage=50,
            overdue=50,
        )

        submission = self._create_submission(
            title="Overdue review case",
            status=Submission.Status.UNDER_REVIEW,
            age_days=5,
        )
        version = submission.versions.get()

        pending_reviewer = self._create_user(
            "pending-priority-reviewer"
        )
        accepted_reviewer = self._create_user(
            "accepted-priority-reviewer"
        )

        ReviewerAssignment.objects.create(
            version=version,
            reviewer=pending_reviewer,
            assigned_by=self.editor,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=(
                self.now - timedelta(days=1)
            ),
            review_deadline=(
                self.now + timedelta(days=7)
            ),
        )
        ReviewerAssignment.objects.create(
            version=version,
            reviewer=accepted_reviewer,
            assigned_by=self.editor,
            status=ReviewerAssignment.Status.ACCEPTED,
            response_deadline=(
                self.now - timedelta(days=5)
            ),
            review_deadline=(
                self.now - timedelta(days=1)
            ),
        )

        result = SubmissionPriorityService.calculate(
            submission,
            journal_settings=self.journal_settings,
            now=self.now,
        )

        overdue_factor = next(
            factor
            for factor in result["factors"]
            if factor["key"] == "overdue_work"
        )

        self.assertEqual(
            overdue_factor["details"]["overdue_invitations"],
            1,
        )
        self.assertEqual(
            overdue_factor["details"]["overdue_reviews"],
            1,
        )
        self.assertGreater(overdue_factor["score"], 0)

    def test_rank_orders_highest_score_first(self):
        self._set_weights(
            waiting=100,
            waiting_cap=30,
        )

        recent_submission = self._create_submission(
            title="Recent submission",
            status=Submission.Status.SUBMITTED,
            age_days=2,
        )
        older_submission = self._create_submission(
            title="Older submission",
            status=Submission.Status.SUBMITTED,
            age_days=20,
        )

        ranked = SubmissionPriorityService.rank(
            [recent_submission, older_submission],
            journal_settings=self.journal_settings,
            now=self.now,
        )

        self.assertEqual(
            ranked[0]["submission"],
            older_submission,
        )
        self.assertGreater(
            ranked[0]["priority"]["score"],
            ranked[1]["priority"]["score"],
        )