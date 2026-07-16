from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.journals.models import Section
from apps.submissions.models import Submission, SubmissionVersion
from apps.workflow.models import ReviewerAssignment


class AssignedEditorAuthorizationTests(APITestCase):
    def setUp(self):
        self.editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR
        )
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR
        )
        self.reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER
        )

        user_model = get_user_model()

        self.editor = self.create_user(
            user_model,
            "assigned-editor",
            self.editor_role,
        )
        self.other_editor = self.create_user(
            user_model,
            "unrelated-editor",
            self.editor_role,
        )
        self.author = self.create_user(
            user_model,
            "review-author",
            self.author_role,
        )
        self.reviewer = self.create_user(
            user_model,
            "candidate-reviewer",
            self.reviewer_role,
        )

        self.section = Section.objects.create(
            name="Review Authorization Tests"
        )

        self.submission = Submission.objects.create(
            title="Protected Review Submission",
            abstract="Authorization test abstract.",
            language="en",
            author=self.author,
            section=self.section,
            assigned_editor=self.editor,
            status=Submission.Status.ASSIGNED,
        )

        self.version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/review-auth/v1/manuscript.pdf",
        )

    def create_user(self, user_model, username, role):
        user = user_model.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )
        user.roles.add(role)
        return user

    def test_non_editor_cannot_view_recommendations(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-recommendations",
                args=[self.submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_unassigned_editor_cannot_view_recommendations(self):
        self.client.force_authenticate(self.other_editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-recommendations",
                args=[self.submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_assigned_editor_can_view_recommendations(self):
        self.client.force_authenticate(self.editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-recommendations",
                args=[self.submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["submission_id"],
            str(self.submission.id),
        )

    def test_unassigned_editor_cannot_invite_reviewer(self):
        self.client.force_authenticate(self.other_editor)

        response = self.client.post(
            reverse(
                "editor-reviews:assign-reviewer",
                args=[self.submission.id],
            ),
            {
                "reviewer_id": str(self.reviewer.id),
                "response_deadline": (
                    timezone.now() + timedelta(days=3)
                ).isoformat(),
                "review_deadline": (
                    timezone.now() + timedelta(days=14)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertFalse(
            ReviewerAssignment.objects.filter(
                version=self.version,
                reviewer=self.reviewer,
            ).exists()
        )