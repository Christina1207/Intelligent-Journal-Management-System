from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import (
    ReviewerProfile,
    Role,
    User,
)
from apps.journals.models import (
    JournalMetadataSettings,
    Section,
)
from apps.publishing.models import PublishedArticle
from apps.reviews.models import Review
from apps.reviews.services import ReviewService
from apps.submissions.models import (
    Submission,
    SubmissionVersion,
)
from apps.workflow.models import (
    ReviewerAssignment,
    SubmissionAssignment,
)

from .services import (
    send_article_published,
    send_author_decision,
    send_editor_assignment,
    send_reviewer_invitation,
)
from .tasks import (
    dispatch_review_deadline_reminders,
    send_review_deadline_reminder_email,
)


@override_settings(
    EMAIL_BACKEND=(
        "django.core.mail.backends.locmem.EmailBackend"
    ),
    DEFAULT_FROM_EMAIL="journal@example.com",
    FRONTEND_URL="https://fallback.example",
    REVIEW_DEADLINE_REMINDER_DAYS=2,
)
class NotificationEmailTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username="author",
            email="author@example.com",
            password="test-password",
            first_name="Private",
            last_name="Author",
        )
        self.reviewer = User.objects.create_user(
            username="reviewer",
            email="reviewer@example.com",
            password="test-password",
            first_name="Test",
            last_name="Reviewer",
        )
        self.editor = User.objects.create_user(
            username="editor",
            email="editor@example.com",
            password="test-password",
            first_name="Section",
            last_name="Editor",
        )

        self.section = Section.objects.create(
            name="Artificial Intelligence",
            slug="artificial-intelligence",
        )

        self.submission = Submission.objects.create(
            title="A Test Manuscript",
            abstract="A test abstract.",
            language="en",
            author=self.author,
            section=self.section,
            assigned_editor=self.editor,
            status=Submission.Status.UNDER_REVIEW,
        )

        self.version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/test/full.pdf",
            blinded_file="submissions/test/blinded.pdf",
        )

        self.assignment = ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=self.reviewer,
            assigned_by=self.editor,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=(
                timezone.now() + timedelta(days=1)
            ),
            review_deadline=(
                timezone.now() + timedelta(days=7)
            ),
        )

        JournalMetadataSettings.objects.update_or_create(
            pk=JournalMetadataSettings.SINGLETON_PK,
            defaults={
                "journal_title": "Test Journal",
                "base_url": "https://journal.example",
                "primary_color": "#123456",
            },
        )

    def test_reviewer_invitation_is_blinded(self):
        sent = send_reviewer_invitation(self.assignment)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)

        message = mail.outbox[0]

        self.assertEqual(
            message.to,
            [self.reviewer.email],
        )
        self.assertIn(
            "A Test Manuscript",
            message.body,
        )
        self.assertIn(
            (
                "https://fallback.example/reviewer/"
                f"assignments/{self.assignment.id}"
            ),
            message.body,
        )
        self.assertNotIn(
            self.author.email,
            message.body,
        )
        self.assertNotIn(
            self.author.get_full_name(),
            message.body,
        )

    def test_revision_decision_sends_one_safe_email(self):
        self.version.decision = (
            SubmissionVersion.Decision.MAJOR_REVISION
        )
        self.version.decision_letter = (
            "Sensitive decision-letter content."
        )
        self.version.save(
            update_fields=[
                "decision",
                "decision_letter",
            ]
        )

        sent = send_author_decision(self.version)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)

        message = mail.outbox[0]

        self.assertEqual(
            message.to,
            [self.author.email],
        )
        self.assertIn(
            "Major Revision",
            message.body,
        )
        self.assertNotIn(
            "Sensitive decision-letter content.",
            message.body,
        )

    def test_editor_assignment_uses_editor_workspace(self):
        assignment = SubmissionAssignment.objects.create(
            submission=self.submission,
            assigned_to=self.editor,
            assigned_by=self.editor,
            role=Role.RoleName.SECTION_EDITOR,
            assignment_reason=(
                SubmissionAssignment
                .AssignmentReason
                .INITIAL
            ),
        )

        sent = send_editor_assignment(assignment)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].to,
            [self.editor.email],
        )
        self.assertIn(
            (
                "https://fallback.example/"
                f"section-editor/submissions/{self.submission.id}"
            ),
            mail.outbox[0].body,
        )

    def test_publication_email_links_to_article(self):
        article = PublishedArticle.objects.create(
            submission=self.submission,
            source_version=self.version,
            section=self.section,
            title=self.submission.title,
            slug="a-test-manuscript",
            abstract=self.submission.abstract,
            language="en",
            pdf_file=self.version.file,
            status=PublishedArticle.Status.PUBLISHED,
            published_at=timezone.now(),
        )

        sent = send_article_published(article)

        self.assertTrue(sent)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(
            mail.outbox[0].to,
            [self.author.email],
        )
        self.assertIn(
            (
                "https://fallback.example/articles/"
                "a-test-manuscript"
            ),
            mail.outbox[0].body,
        )

    def test_deadline_reminder_is_sent_only_once(self):
        self.assignment.status = (
            ReviewerAssignment.Status.ACCEPTED
        )
        self.assignment.review_deadline = (
            timezone.now() + timedelta(days=1)
        )
        self.assignment.save(
            update_fields=[
                "status",
                "review_deadline",
            ]
        )

        first_result = (
            send_review_deadline_reminder_email.run(
                str(self.assignment.id)
            )
        )
        second_result = (
            send_review_deadline_reminder_email.run(
                str(self.assignment.id)
            )
        )

        self.assertTrue(first_result)
        self.assertFalse(second_result)
        self.assertEqual(len(mail.outbox), 1)

        self.assignment.refresh_from_db()
        self.assertIsNotNone(
            self.assignment.review_reminder_sent_at
        )

    @patch(
        "apps.notifications.tasks."
        "send_review_deadline_reminder_email.delay"
    )
    def test_dispatch_queues_due_reminder(
        self,
        reminder_delay,
    ):
        self.assignment.status = (
            ReviewerAssignment.Status.ACCEPTED
        )
        self.assignment.review_deadline = (
            timezone.now() + timedelta(days=1)
        )
        self.assignment.save(
            update_fields=[
                "status",
                "review_deadline",
            ]
        )

        queued_count = (
            dispatch_review_deadline_reminders.run()
        )

        self.assertEqual(queued_count, 1)
        reminder_delay.assert_called_once_with(
            str(self.assignment.id)
        )

    @patch(
        "apps.notifications.tasks."
        "send_review_deadline_reminder_email.delay"
    )
    def test_dispatch_ignores_completed_review(
        self,
        reminder_delay,
    ):
        self.assignment.status = (
            ReviewerAssignment.Status.ACCEPTED
        )
        self.assignment.review_deadline = (
            timezone.now() + timedelta(days=1)
        )
        self.assignment.save(
            update_fields=[
                "status",
                "review_deadline",
            ]
        )

        Review.objects.create(
            assignment=self.assignment,
            recommendation=Review.Recommendation.ACCEPT,
            comments_for_author="Author-facing comments.",
            comments_for_editor="Confidential editor comments.",
        )

        queued_count = (
            dispatch_review_deadline_reminders.run()
        )

        self.assertEqual(queued_count, 0)
        reminder_delay.assert_not_called()

    @patch(
        "apps.notifications.tasks."
        "send_reviewer_invitation_email.delay"
    )
    def test_reviewer_assignment_queues_once_after_commit(
        self,
        invitation_delay,
    ):
        self.assignment.delete()

        reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER
        )
        editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR
        )

        self.reviewer.roles.add(reviewer_role)
        self.editor.roles.add(editor_role)

        profile = ReviewerProfile.objects.create(
            user=self.reviewer
        )
        profile.sections.add(self.section)

        self.submission.status = Submission.Status.ASSIGNED
        self.submission.save(update_fields=["status"])

        with self.captureOnCommitCallbacks(execute=True):
            assignment = ReviewService.assign_reviewer(
                editor=self.editor,
                reviewer=self.reviewer,
                submission=self.submission,
                response_deadline=(
                    timezone.now() + timedelta(days=2)
                ),
                review_deadline=(
                    timezone.now() + timedelta(days=10)
                ),
            )

        invitation_delay.assert_called_once_with(
            str(assignment.id)
        )