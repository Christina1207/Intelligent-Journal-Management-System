from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.journals.models import Section
from apps.reviews.models import Review
from apps.submissions.models import Submission, SubmissionVersion
from apps.workflow.models import ReviewerAssignment


class ReviewerManuscriptDownloadApiTests(APITestCase):
    def setUp(self):
        self.reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER
        )
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR
        )
        self.editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR
        )

        user_model = get_user_model()
        self.author = self.create_user(user_model, "download-author", self.author_role)
        self.editor = self.create_user(user_model, "download-editor", self.editor_role)
        self.reviewer = self.create_user(
            user_model,
            "accepted-download-reviewer",
            self.reviewer_role,
        )
        self.other_reviewer = self.create_user(
            user_model,
            "other-download-reviewer",
            self.reviewer_role,
        )

        self.section = Section.objects.create(name="Reviewer Downloads")
        self.submission = Submission.objects.create(
            title="Blinded reviewer manuscript",
            abstract="Reviewer download test abstract.",
            language="en",
            author=self.author,
            section=self.section,
            assigned_editor=self.editor,
            status=Submission.Status.UNDER_REVIEW,
        )
        self.version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/download/v1/full/manuscript.pdf",
            blinded_file="submissions/download/v1/blinded/manuscript.pdf",
        )

    def create_user(self, user_model, username, role):
        user = user_model.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )
        user.roles.add(role)
        return user

    def create_assignment(self, *, reviewer=None, status_value):
        return ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=reviewer or self.reviewer,
            assigned_by=self.editor,
            status=status_value,
            response_deadline=timezone.now() + timedelta(days=3),
            review_deadline=timezone.now() + timedelta(days=14),
        )

    def download_url(self, assignment):
        return reverse(
            "reviewer:reviewer-manuscript-download",
            args=[assignment.id],
        )

    @patch("apps.reviews.views.StorageService")
    def test_accepted_reviewer_receives_url_signed_from_blinded_file(
        self,
        storage_service_class,
    ):
        assignment = self.create_assignment(
            status_value=ReviewerAssignment.Status.ACCEPTED,
        )
        storage_service = storage_service_class.return_value
        storage_service.get_public_url.return_value = (
            "http://localhost:9000/manuscripts/blinded-signed-url"
        )

        self.client.force_authenticate(self.reviewer)

        response = self.client.get(self.download_url(assignment))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["assignment_id"], str(assignment.id))
        self.assertEqual(response.data["version_id"], str(self.version.id))
        self.assertEqual(response.data["version_number"], 1)
        self.assertEqual(response.data["expires_in_seconds"], 600)
        self.assertEqual(
            response.data["manuscript_url"],
            "http://localhost:9000/manuscripts/blinded-signed-url",
        )
        self.assertNotIn("file", response.data)
        self.assertNotIn("blinded_file", response.data)
        storage_service.get_public_url.assert_called_once_with(
            object_name=self.version.blinded_file,
            expires_in_seconds=600,
        )

    @patch("apps.reviews.views.StorageService")
    def test_non_accepted_and_unrelated_reviewers_are_denied(
        self,
        storage_service_class,
    ):
        cases = [
            ("pending", ReviewerAssignment.Status.PENDING, self.reviewer),
            ("declined", ReviewerAssignment.Status.DECLINED, self.reviewer),
            ("cancelled", ReviewerAssignment.Status.CANCELLED, self.reviewer),
            (
                "unrelated",
                ReviewerAssignment.Status.ACCEPTED,
                self.other_reviewer,
            ),
        ]

        for label, assignment_status, authenticated_user in cases:
            with self.subTest(label=label):
                assignment = self.create_assignment(
                    reviewer=self.reviewer,
                    status_value=assignment_status,
                )
                self.client.force_authenticate(authenticated_user)

                response = self.client.get(self.download_url(assignment))

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                assignment.delete()

        storage_service_class.assert_not_called()

    @patch("apps.reviews.views.StorageService")
    def test_missing_blinded_file_returns_400_and_never_signs_full_file(
        self,
        storage_service_class,
    ):
        self.version.blinded_file = ""
        self.version.save(update_fields=["blinded_file"])
        assignment = self.create_assignment(
            status_value=ReviewerAssignment.Status.ACCEPTED,
        )

        self.client.force_authenticate(self.reviewer)

        response = self.client.get(self.download_url(assignment))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No blinded manuscript file", str(response.data))
        storage_service_class.assert_not_called()


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
        self.replacement_reviewer = self.create_user(
            user_model,
            "replacement-reviewer",
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

    def create_assignment(self, *, reviewer=None, status_value=None):
        return ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=reviewer or self.reviewer,
            assigned_by=self.editor,
            status=status_value or ReviewerAssignment.Status.ACCEPTED,
            response_deadline=timezone.now() + timedelta(days=3),
            review_deadline=timezone.now() + timedelta(days=14),
        )

    def replacement_payload(self, *, reviewer=None):
        return {
            "reviewer_id": str(
                (reviewer or self.replacement_reviewer).id
            ),
            "response_deadline": (
                timezone.now() + timedelta(days=3)
            ).isoformat(),
            "review_deadline": (
                timezone.now() + timedelta(days=14)
            ).isoformat(),
            "reason": (
                "The original reviewer became unavailable."
            ),
        }

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

    def test_accepted_assignment_can_be_replaced(self):
        assignment = self.create_assignment()
        before_request = timezone.now()

        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:replace-assignment",
                args=[assignment.id],
            ),
            self.replacement_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        assignment.refresh_from_db()
        self.assertEqual(
            assignment.status,
            ReviewerAssignment.Status.CANCELLED,
        )
        self.assertEqual(assignment.cancelled_by, self.editor)
        self.assertGreaterEqual(
            assignment.cancelled_at,
            before_request,
        )
        self.assertEqual(
            assignment.cancellation_reason,
            "The original reviewer became unavailable.",
        )

        replacement = ReviewerAssignment.objects.get(
            reviewer=self.replacement_reviewer,
            version=self.version,
        )
        self.assertEqual(
            replacement.status,
            ReviewerAssignment.Status.PENDING,
        )
        self.assertEqual(replacement.replaces, assignment)

        self.assertEqual(
            response.data["cancelled_assignment"]["status"],
            ReviewerAssignment.Status.CANCELLED,
        )
        self.assertEqual(
            response.data["replacement_assignment"]["status"],
            ReviewerAssignment.Status.PENDING,
        )
        self.assertEqual(
            response.data["replacement_assignment"]["replaces"],
            str(assignment.id),
        )

    def test_submitted_review_assignment_cannot_be_cancelled_or_replaced(self):
        assignment = self.create_assignment()
        Review.objects.create(
            assignment=assignment,
            recommendation=Review.Recommendation.ACCEPT,
            comments_for_author="This manuscript is ready.",
            comments_for_editor="No confidential concerns.",
        )

        self.client.force_authenticate(self.editor)

        cancel_response = self.client.post(
            reverse(
                "editor-reviews:cancel-assignment",
                args=[assignment.id],
            ),
            {
                "reason": (
                    "The original reviewer became unavailable."
                ),
            },
            format="json",
        )
        replace_response = self.client.post(
            reverse(
                "editor-reviews:replace-assignment",
                args=[assignment.id],
            ),
            self.replacement_payload(),
            format="json",
        )

        self.assertEqual(
            cancel_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            replace_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        assignment.refresh_from_db()
        self.assertEqual(
            assignment.status,
            ReviewerAssignment.Status.ACCEPTED,
        )
        self.assertIsNone(assignment.cancelled_at)
        self.assertIsNone(assignment.cancelled_by)
        self.assertFalse(
            ReviewerAssignment.objects.filter(
                reviewer=self.replacement_reviewer,
                version=self.version,
            ).exists()
        )

    def test_unrelated_editor_cannot_replace_assignment(self):
        assignment = self.create_assignment()

        self.client.force_authenticate(self.other_editor)

        response = self.client.post(
            reverse(
                "editor-reviews:replace-assignment",
                args=[assignment.id],
            ),
            self.replacement_payload(),
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

        assignment.refresh_from_db()
        self.assertEqual(
            assignment.status,
            ReviewerAssignment.Status.ACCEPTED,
        )
        self.assertIsNone(assignment.cancelled_at)
        self.assertIsNone(assignment.cancelled_by)

    def test_invalid_replacement_reviewer_rolls_back_cancellation(self):
        assignment = self.create_assignment()

        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:replace-assignment",
                args=[assignment.id],
            ),
            {
                "reviewer_id": str(self.author.id),
                "response_deadline": (
                    timezone.now() + timedelta(days=3)
                ).isoformat(),
                "review_deadline": (
                    timezone.now() + timedelta(days=14)
                ).isoformat(),
                "reason": (
                    "The original reviewer became unavailable."
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        assignment.refresh_from_db()
        self.assertEqual(
            assignment.status,
            ReviewerAssignment.Status.ACCEPTED,
        )
        self.assertIsNone(assignment.cancelled_at)
        self.assertIsNone(assignment.cancelled_by)
    
    def test_reviewer_invitation_rejects_past_response_deadline(self):
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:assign-reviewer",
                args=[self.submission.id],
            ),
            {
                "reviewer_id": str(self.reviewer.id),
                "response_deadline": (
                    timezone.now() - timedelta(days=1)
                ).isoformat(),
                "review_deadline": (
                    timezone.now() + timedelta(days=10)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("response_deadline", response.data)


    def test_reviewer_invitation_rejects_past_review_deadline(self):
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:assign-reviewer",
                args=[self.submission.id],
            ),
            {
                "reviewer_id": str(self.reviewer.id),
                "response_deadline": (
                    timezone.now() + timedelta(days=2)
                ).isoformat(),
                "review_deadline": (
                    timezone.now() - timedelta(days=1)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("review_deadline", response.data)


    def test_review_deadline_must_follow_response_deadline(self):
        self.client.force_authenticate(self.editor)

        response = self.client.post(
            reverse(
                "editor-reviews:assign-reviewer",
                args=[self.submission.id],
            ),
            {
                "reviewer_id": str(self.reviewer.id),
                "response_deadline": (
                    timezone.now() + timedelta(days=10)
                ).isoformat(),
                "review_deadline": (
                    timezone.now() + timedelta(days=5)
                ).isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("review_deadline", response.data)

    def test_assigned_editor_can_search_reviewer_candidates(self):
        self.reviewer.first_name = "Grace"
        self.reviewer.last_name = "Hopper"
        self.reviewer.affiliation = "Computing Research Lab"
        self.reviewer.save(
            update_fields=[
                "first_name",
                "last_name",
                "affiliation",
            ]
        )

        self.client.force_authenticate(self.editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-candidates",
                args=[self.submission.id],
            ),
            {"search": "Hopper"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["candidates"][0]["id"],
            str(self.reviewer.id),
        )


    def test_unassigned_editor_cannot_search_candidates(self):
        self.client.force_authenticate(self.other_editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-candidates",
                args=[self.submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )


    def test_candidate_search_excludes_already_invited_reviewer(self):
        ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=self.reviewer,
            assigned_by=self.editor,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=(
                timezone.now() + timedelta(days=3)
            ),
            review_deadline=(
                timezone.now() + timedelta(days=14)
            ),
        )

        self.client.force_authenticate(self.editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-candidates",
                args=[self.submission.id],
            )
        )

        returned_ids = {
            candidate["id"]
            for candidate in response.data["candidates"]
        }

        self.assertNotIn(
            str(self.reviewer.id),
            returned_ids,
        )


    def test_candidate_search_excludes_inactive_reviewer(self):
        self.reviewer.status = get_user_model().Status.INACTIVE
        self.reviewer.save(update_fields=["status"])

        self.client.force_authenticate(self.editor)

        response = self.client.get(
            reverse(
                "editor-reviews:reviewer-candidates",
                args=[self.submission.id],
            )
        )

        returned_ids = {
            candidate["id"]
            for candidate in response.data["candidates"]
        }

        self.assertNotIn(
            str(self.reviewer.id),
            returned_ids,
        )

class ReviewerInvitationResponseApiTests(APITestCase):
    def setUp(self):
        reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER,
        )
        author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )
        editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR,
        )

        user_model = get_user_model()

        self.author = user_model.objects.create_user(
            username="response-author",
            email="response-author@example.com",
            password="testpass123",
        )
        self.author.roles.add(author_role)

        self.editor = user_model.objects.create_user(
            username="response-editor",
            email="response-editor@example.com",
            password="testpass123",
        )
        self.editor.roles.add(editor_role)

        self.reviewer = user_model.objects.create_user(
            username="invited-response-reviewer",
            email="invited-response-reviewer@example.com",
            password="testpass123",
        )
        self.reviewer.roles.add(reviewer_role)

        self.other_reviewer = user_model.objects.create_user(
            username="other-response-reviewer",
            email="other-response-reviewer@example.com",
            password="testpass123",
        )
        self.other_reviewer.roles.add(reviewer_role)

        self.section = Section.objects.create(
            name="Reviewer Response Tests",
        )
        self.submission = Submission.objects.create(
            title="Invitation response manuscript",
            abstract="Reviewer invitation response test.",
            language="en",
            author=self.author,
            section=self.section,
            assigned_editor=self.editor,
            status=Submission.Status.UNDER_REVIEW,
        )
        self.version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/response/v1/full/manuscript.pdf",
            blinded_file="submissions/response/v1/blinded/manuscript.pdf",
        )
        self.assignment = ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=self.reviewer,
            assigned_by=self.editor,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=timezone.now() + timedelta(days=3),
            review_deadline=timezone.now() + timedelta(days=14),
        )
        self.url = reverse(
            "reviewer:respond-assignment",
            args=[self.assignment.id],
        )

    def test_invited_reviewer_can_accept(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            self.url,
            {"accept": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["status"],
            ReviewerAssignment.Status.ACCEPTED,
        )

        self.assignment.refresh_from_db()
        self.assertEqual(
            self.assignment.status,
            ReviewerAssignment.Status.ACCEPTED,
        )

    def test_invited_reviewer_can_decline(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            self.url,
            {"accept": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["status"],
            ReviewerAssignment.Status.DECLINED,
        )

        self.assignment.refresh_from_db()
        self.assertEqual(
            self.assignment.status,
            ReviewerAssignment.Status.DECLINED,
        )

    def test_another_reviewer_cannot_respond(self):
        self.client.force_authenticate(self.other_reviewer)

        response = self.client.post(
            self.url,
            {"accept": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.assignment.refresh_from_db()
        self.assertEqual(
            self.assignment.status,
            ReviewerAssignment.Status.PENDING,
        )

    def test_user_without_reviewer_role_cannot_respond(self):
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {"accept": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.assignment.refresh_from_db()
        self.assertEqual(
            self.assignment.status,
            ReviewerAssignment.Status.PENDING,
        )
