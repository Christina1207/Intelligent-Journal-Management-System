from datetime import timedelta
from unittest.mock import ANY, call, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.reviews.models import Review
from apps.accounts.models import Role
from apps.journals.models import Section
from apps.submissions.models import Submission, SubmissionVersion
from apps.workflow.models import ReviewerAssignment
from config.constants import REVISION_REVIEW_DEADLINE_DAYS


def pdf_upload(name="manuscript.pdf", content=b"%PDF-1.4\nmanuscript\n%%EOF"):
    return SimpleUploadedFile(
        name,
        content,
        content_type="application/pdf",
    )


def text_upload(name="manuscript.txt"):
    return SimpleUploadedFile(
        name,
        b"not a pdf",
        content_type="text/plain",
    )


class SubmissionDetailApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.author = self._create_user("author", Role.RoleName.AUTHOR)
        self.other_author = self._create_user("other-author", Role.RoleName.AUTHOR)
        self.section_editor = self._create_user(
            "section-editor",
            Role.RoleName.SECTION_EDITOR,
        )
        self.unassigned_section_editor = self._create_user(
            "unassigned-section-editor",
            Role.RoleName.SECTION_EDITOR,
        )
        self.section_manager = self._create_user(
            "section-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.other_section_manager = self._create_user(
            "other-section-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.editor_in_chief = self._create_user(
            "editor-in-chief",
            Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.admin = self._create_user("admin", Role.RoleName.ADMIN)
        self.reviewer = self._create_user("reviewer", Role.RoleName.REVIEWER)

        self.section = Section.objects.create(
            name="Computer Science",
            manager=self.section_manager,
        )
        self.other_section = Section.objects.create(
            name="Physics",
            manager=self.other_section_manager,
        )

        self.submission = self._create_submission(
            title="Paper title",
            author=self.author,
            section=self.section,
            assigned_editor=self.section_editor,
            submission_status=Submission.Status.UNDER_REVIEW,
        )
        self.version_one = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/private/v1/manuscript.pdf",
            blinded_file="submissions/private/v1/blinded.pdf",
            decision=SubmissionVersion.Decision.MINOR_REVISION,
            decision_letter="Please revise.",
        )
        self.version_two = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=2,
            file="submissions/private/v2/manuscript.pdf",
            blinded_file="submissions/private/v2/blinded.pdf",
            decision=SubmissionVersion.Decision.PENDING,
            decision_letter="",
        )

        self.other_submission = self._create_submission(
            title="Other paper",
            author=self.other_author,
            section=self.other_section,
            submission_status=Submission.Status.SUBMITTED,
        )
        SubmissionVersion.objects.create(
            submission=self.other_submission,
            version_number=1,
            file="submissions/private/other/v1/manuscript.pdf",
            blinded_file="submissions/private/other/v1/blinded.pdf",
        )

    def _create_user(self, username, role_names):
        if isinstance(role_names, str):
            role_names = [role_names]

        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
        )
        for role_name in role_names:
            user.roles.add(self.roles[role_name])

        return user

    def _create_submission(
        self,
        *,
        title,
        author,
        section,
        assigned_editor=None,
        submission_status=Submission.Status.SUBMITTED,
    ):
        return Submission.objects.create(
            title=title,
            abstract="A detailed research abstract.",
            language="en",
            cover_letter="Private author cover letter.",
            status=submission_status,
            author=author,
            section=section,
            assigned_editor=assigned_editor,
        )

    def _detail_url(self, submission):
        return reverse("submission-detail", args=[submission.id])

    def test_submission_detail_requires_authentication(self):
        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owning_author_can_access_submission_detail(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.submission.id))

    def test_author_cannot_access_another_authors_submission(self):
        self.client.force_authenticate(self.other_author)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_assigned_section_editor_can_access_submission_detail(self):
        self.client.force_authenticate(self.section_editor)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unassigned_section_editor_cannot_access_submission_detail(self):
        self.client.force_authenticate(self.unassigned_section_editor)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_section_manager_can_access_only_managed_section_submissions(self):
        self.client.force_authenticate(self.section_manager)

        managed_response = self.client.get(self._detail_url(self.submission))
        other_response = self.client.get(self._detail_url(self.other_submission))

        self.assertEqual(managed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_editor_in_chief_and_admin_can_access_all_submission_details(self):
        for user in [self.editor_in_chief, self.admin]:
            with self.subTest(username=user.username):
                self.client.force_authenticate(user)

                response = self.client.get(self._detail_url(self.other_submission))

                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reviewer_role_does_not_grant_submission_detail_access(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_response_contains_author_safe_detail_shape(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {
                "id",
                "title",
                "abstract",
                "language",
                "status",
                "section",
                "topic",
                "submitted_at",
                "latest_version",
            },
        )
        self.assertEqual(
            set(response.data["section"].keys()),
            {"id", "name", "slug"},
        )
        self.assertIsNone(response.data["topic"])

    def test_latest_version_uses_highest_version_number(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["latest_version"]["id"], str(self.version_two.id))
        self.assertEqual(response.data["latest_version"]["version_number"], 2)
        self.assertEqual(
            set(response.data["latest_version"].keys()),
            {
                "id",
                "version_number",
                "decision",
                "decision_letter",
                "submitted_at",
            },
        )

    def test_submission_without_versions_returns_null_latest_version(self):
        submission = self._create_submission(
            title="Legacy submission without versions",
            author=self.author,
            section=self.section,
        )
        self.client.force_authenticate(self.author)

        response = self.client.get(self._detail_url(submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["latest_version"])

    def test_response_does_not_expose_private_submission_or_version_fields(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self._detail_url(self.submission))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        forbidden_top_level_fields = {
            "author",
            "assigned_editor",
            "cover_letter",
            "abstract_embedding",
            "versions",
            "reviewer",
            "reviewers",
        }
        forbidden_version_fields = {
            "file",
            "blinded_file",
            "decided_at",
            "decided_by",
            "reviewer",
            "reviewers",
        }

        for field in forbidden_top_level_fields:
            self.assertNotIn(field, response.data)

        for field in forbidden_version_fields:
            self.assertNotIn(field, response.data["latest_version"])
    def test_author_cannot_list_another_authors_versions(self):
        self.client.force_authenticate(self.other_author)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


    def test_manager_cannot_list_versions_outside_managed_section(self):
        self.client.force_authenticate(self.section_manager)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[self.other_submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_version_list_response_does_not_expose_manuscript_paths(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)

        for version in response.data["results"]:
            self.assertNotIn("file", version)
            self.assertNotIn("blinded_file", version)
            self.assertIn("full_manuscript_available", version)
            self.assertIn("blinded_manuscript_available", version)

    def test_decided_version_exposes_only_anonymized_author_feedback(self):
        assignment = ReviewerAssignment.objects.create(
            version=self.version_one,
            reviewer=self.reviewer,
            assigned_by=self.section_editor,
            status=ReviewerAssignment.Status.ACCEPTED,
            response_deadline=timezone.now() - timedelta(days=10),
            review_deadline=timezone.now() - timedelta(days=3),
        )
        Review.objects.create(
            assignment=assignment,
            recommendation=Review.Recommendation.MINOR_REVISION,
            comments_for_author=(
                "Please clarify the sampling method and evaluation protocol."
            ),
            comments_for_editor=(
                "The paper can become publishable after revision."
            ),
        )

        self.client.force_authenticate(self.author)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        versions = {
            version["version_number"]: version
            for version in response.data["results"]
        }
        feedback = versions[1]["reviewer_feedback"]

        self.assertEqual(
            feedback,
            [
                {
                    "reviewer_label": "Reviewer 1",
                    "comments_for_author": (
                        "Please clarify the sampling method and "
                        "evaluation protocol."
                    ),
                }
            ],
        )

        serialized_feedback = str(feedback)

        self.assertNotIn(str(self.reviewer.id), serialized_feedback)
        self.assertNotIn(self.reviewer.email, serialized_feedback)
        self.assertNotIn(
            "The paper can become publishable",
            serialized_feedback,
        )
        self.assertNotIn("recommendation", feedback[0])
        self.assertNotIn("comments_for_editor", feedback[0])
    def test_pending_version_does_not_release_reviewer_feedback(self):
        assignment = ReviewerAssignment.objects.create(
            version=self.version_two,
            reviewer=self.reviewer,
            assigned_by=self.section_editor,
            status=ReviewerAssignment.Status.ACCEPTED,
            response_deadline=timezone.now() - timedelta(days=10),
            review_deadline=timezone.now() - timedelta(days=3),
        )
        Review.objects.create(
            assignment=assignment,
            recommendation=Review.Recommendation.ACCEPT,
            comments_for_author="This report has not been released yet.",
            comments_for_editor="Confidential editorial note.",
        )

        self.client.force_authenticate(self.author)

        response = self.client.get(
            reverse(
                "submission-version-list",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        versions = {
            version["version_number"]: version
            for version in response.data["results"]
        }

        self.assertEqual(versions[2]["decision"], "PENDING")
        self.assertEqual(versions[2]["reviewer_feedback"], [])
        self.assertNotIn(
            "This report has not been released yet.",
            str(response.data),
        )
        self.assertNotIn(
            "Confidential editorial note.",
            str(response.data),
        )

class AuthorDashboardApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.author = self._create_user("dashboard-author", Role.RoleName.AUTHOR)
        self.other_author = self._create_user(
            "dashboard-other-author",
            Role.RoleName.AUTHOR,
        )
        self.reviewer = self._create_user(
            "dashboard-reviewer",
            Role.RoleName.REVIEWER,
        )

        self.section = Section.objects.create(name="Computer Science")
        self.other_section = Section.objects.create(name="Physics")
        self.url = reverse("submission-author-dashboard")

    def _create_user(self, username, role_names):
        if isinstance(role_names, str):
            role_names = [role_names]

        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
        )
        for role_name in role_names:
            user.roles.add(self.roles[role_name])

        return user

    def _create_submission(
        self,
        *,
        title,
        author,
        section,
        submission_status,
        submitted_at,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract="A detailed research abstract.",
            language="en",
            cover_letter="Private author cover letter.",
            status=submission_status,
            author=author,
            section=section,
        )
        Submission.objects.filter(pk=submission.pk).update(
            submitted_at=submitted_at,
        )
        submission.refresh_from_db()
        return submission

    def _seed_dashboard_submissions(self):
        base_time = timezone.now() - timedelta(days=10)
        submissions = []
        statuses = [
            ("Submitted paper", Submission.Status.SUBMITTED),
            ("Assigned paper", Submission.Status.ASSIGNED),
            ("Under review paper", Submission.Status.UNDER_REVIEW),
            ("Reviewed paper", Submission.Status.REVIEWED),
            ("Revised paper", Submission.Status.REVISED),
            ("Revision paper", Submission.Status.UNDER_REVISION),
            ("Accepted paper", Submission.Status.ACCEPTED),
            ("Rejected paper", Submission.Status.REJECTED),
            ("Suspended paper", Submission.Status.SUSPENDED),
        ]

        for index, (title, submission_status) in enumerate(statuses):
            submissions.append(
                self._create_submission(
                    title=title,
                    author=self.author,
                    section=self.section,
                    submission_status=submission_status,
                    submitted_at=base_time + timedelta(days=index),
                )
            )

        self._create_submission(
            title="Other author revision",
            author=self.other_author,
            section=self.other_section,
            submission_status=Submission.Status.UNDER_REVISION,
            submitted_at=base_time + timedelta(days=20),
        )

        return submissions

    def test_author_dashboard_requires_authentication(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_author_cannot_access_author_dashboard(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_author_dashboard_returns_summary_and_submission_lists(self):
        self._seed_dashboard_submissions()
        self.client.force_authenticate(self.author)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["summary"],
            {
                "total": 9,
                "active": 5,
                "needs_revision": 1,
                "accepted": 1,
                "rejected": 1,
            },
        )

        self.assertEqual(len(response.data["action_required"]), 1)
        action_item = response.data["action_required"][0]
        self.assertEqual(action_item["title"], "Revision paper")
        self.assertEqual(action_item["status"], Submission.Status.UNDER_REVISION)
        self.assertEqual(action_item["section"], "Computer Science")
        self.assertEqual(action_item["action"], "UPLOAD_REVISION")

        recent_titles = [
            submission["title"]
            for submission in response.data["recent_submissions"]
        ]
        self.assertEqual(
            recent_titles,
            [
                "Suspended paper",
                "Rejected paper",
                "Accepted paper",
                "Revision paper",
                "Revised paper",
            ],
        )

    def test_author_dashboard_response_does_not_expose_private_fields(self):
        self._seed_dashboard_submissions()
        self.client.force_authenticate(self.author)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data.keys()),
            {"summary", "action_required", "recent_submissions"},
        )
        self.assertEqual(
            set(response.data["summary"].keys()),
            {"total", "active", "needs_revision", "accepted", "rejected"},
        )

        forbidden_fields = {
            "abstract",
            "language",
            "cover_letter",
            "author",
            "assigned_editor",
            "abstract_embedding",
            "topic",
            "versions",
            "reviewer",
            "reviewers",
        }

        for collection_name in ["action_required", "recent_submissions"]:
            for submission in response.data[collection_name]:
                for field in forbidden_fields:
                    self.assertNotIn(field, submission)

    def test_author_without_submissions_receives_empty_dashboard(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["summary"],
            {
                "total": 0,
                "active": 0,
                "needs_revision": 0,
                "accepted": 0,
                "rejected": 0,
            },
        )
        self.assertEqual(response.data["action_required"], [])
        self.assertEqual(response.data["recent_submissions"], [])


class RevisionUploadApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.author = self._create_user("revision-author", Role.RoleName.AUTHOR)
        self.section_editor = self._create_user(
            "revision-editor",
            Role.RoleName.SECTION_EDITOR,
        )
        self.reviewer = self._create_user(
            "revision-reviewer",
            Role.RoleName.REVIEWER,
        )
        self.section = Section.objects.create(name="Artificial Intelligence")
        self.submission = Submission.objects.create(
            title="Revision workflow paper",
            abstract="A detailed research abstract.",
            language="en",
            cover_letter="Private author cover letter.",
            status=Submission.Status.UNDER_REVISION,
            author=self.author,
            section=self.section,
            assigned_editor=self.section_editor,
        )
        self.previous_version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/private/v1/manuscript.pdf",
            blinded_file="submissions/private/v1/blinded.pdf",
            decision=SubmissionVersion.Decision.MINOR_REVISION,
            decision_letter="Please revise and respond to reviewer comments.",
        )
        self.previous_assignment = ReviewerAssignment.objects.create(
            version=self.previous_version,
            reviewer=self.reviewer,
            assigned_by=self.section_editor,
            status=ReviewerAssignment.Status.ACCEPTED,
            response_deadline=timezone.now() - timedelta(days=10),
            review_deadline=timezone.now() - timedelta(days=3),
        )
        self.url = reverse("submission-revision-upload", args=[self.submission.id])

    def _create_user(self, username, role_names):
        if isinstance(role_names, str):
            role_names = [role_names]

        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
        )
        for role_name in role_names:
            user.roles.add(self.roles[role_name])

        return user

    def _pdf_upload(self, name="revision.pdf"):
        return pdf_upload(name=name, content=b"%PDF-1.4\nrevised manuscript\n%%EOF")

    def _text_upload(self):
        return text_upload("revision.txt")

    @patch("apps.submissions.services.StorageService")
    def test_author_can_upload_revision_with_response_to_reviewers(
        self,
        storage_class,
    ):
        full_object_name = f"submissions/{self.submission.id}/v2/revision.pdf"
        blinded_object_name = (
            f"submissions/{self.submission.id}/v2/revision-blinded.pdf"
        )
        storage_class.return_value.upload.side_effect = [
            full_object_name,
            blinded_object_name,
        ]
        response_text = "We revised the methods and expanded the discussion."
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "file": self._pdf_upload(),
                "blinded_file": self._pdf_upload("revision-blinded.pdf"),
                "response_to_reviewers": response_text,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["response_to_reviewers"], response_text)

        self.submission.refresh_from_db()
        self.assertEqual(self.submission.status, Submission.Status.UNDER_REVIEW)

        new_version = self.submission.versions.get(version_number=2)
        self.assertEqual(new_version.file, full_object_name)
        self.assertEqual(new_version.blinded_file, blinded_object_name)
        self.assertEqual(new_version.response_to_reviewers, response_text)

        carried_assignment = ReviewerAssignment.objects.get(
            version=new_version,
            reviewer=self.reviewer,
        )
        self.assertEqual(carried_assignment.status, ReviewerAssignment.Status.ACCEPTED)
        self.assertEqual(carried_assignment.carried_from, self.previous_assignment)
        self.assertEqual(carried_assignment.assigned_by, self.section_editor)
        self.assertEqual(
            carried_assignment.review_deadline - carried_assignment.response_deadline,
            timedelta(days=REVISION_REVIEW_DEADLINE_DAYS),
        )
        self.assertGreater(carried_assignment.review_deadline, timezone.now())
        self.assertEqual(storage_class.return_value.upload.call_count, 2)
        storage_class.return_value.upload.assert_has_calls(
            [
                call(
                    file_obj=ANY,
                    submission_id=str(self.submission.id),
                    version_number=2,
                    filename="revision.pdf",
                    variant="full",
                ),
                call(
                    file_obj=ANY,
                    submission_id=str(self.submission.id),
                    version_number=2,
                    filename="revision-blinded.pdf",
                    variant="blinded",
                ),
            ]
        )

    @patch("apps.submissions.services.StorageService")
    def test_author_can_upload_revision_without_response_to_reviewers(
        self,
        storage_class,
    ):
        full_object_name = f"submissions/{self.submission.id}/v2/revision.pdf"
        blinded_object_name = (
            f"submissions/{self.submission.id}/v2/revision-blinded.pdf"
        )
        storage_class.return_value.upload.side_effect = [
            full_object_name,
            blinded_object_name,
        ]
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "file": self._pdf_upload(),
                "blinded_file": self._pdf_upload("revision-blinded.pdf"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["response_to_reviewers"], "")

        new_version = self.submission.versions.get(version_number=2)
        self.assertEqual(new_version.file, full_object_name)
        self.assertEqual(new_version.blinded_file, blinded_object_name)
        self.assertEqual(new_version.response_to_reviewers, "")

    @patch("apps.submissions.services.StorageService")
    def test_revision_upload_rejects_author_supplied_review_deadline(
        self,
        storage_class,
    ):
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "file": self._pdf_upload(),
                "blinded_file": self._pdf_upload("revision-blinded.pdf"),
                "review_deadline": timezone.now().isoformat(),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("review_deadline", response.data)
        self.assertFalse(self.submission.versions.filter(version_number=2).exists())
        storage_class.return_value.upload.assert_not_called()

    @patch("apps.submissions.services.StorageService")
    def test_revision_upload_rejects_non_pdf_file(self, storage_class):
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "file": self._text_upload(),
                "blinded_file": self._pdf_upload("revision-blinded.pdf"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file", response.data)
        self.assertFalse(self.submission.versions.filter(version_number=2).exists())
        storage_class.return_value.upload.assert_not_called()

    @patch("apps.submissions.services.StorageService")
    def test_revision_upload_rejects_missing_blinded_file(self, storage_class):
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {"file": self._pdf_upload()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("blinded_file", response.data)
        self.assertFalse(self.submission.versions.filter(version_number=2).exists())
        storage_class.return_value.upload.assert_not_called()


class SubmissionCreateApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.author = self._create_user("submission-author", Role.RoleName.AUTHOR)
        self.reviewer = self._create_user("submission-reviewer", Role.RoleName.REVIEWER)
        self.section = Section.objects.create(name="Artificial Intelligence")
        self.url = reverse("submission-create")

    def _create_user(self, username, role_names):
        if isinstance(role_names, str):
            role_names = [role_names]

        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
        )
        for role_name in role_names:
            user.roles.add(self.roles[role_name])

        return user

    @patch("apps.submissions.services.StorageService")
    def test_author_can_create_submission_with_full_and_blinded_files(
        self,
        storage_class,
    ):
        submission_id = "submission-1"
        full_object_name = f"submissions/{submission_id}/v1/full.pdf"
        blinded_object_name = f"submissions/{submission_id}/v1/blinded.pdf"
        storage_class.return_value.upload.side_effect = [
            full_object_name,
            blinded_object_name,
        ]

        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "title": "Submission with blinded manuscript",
                "abstract": "A detailed research abstract.",
                "language": "en",
                "section": str(self.section.id),
                "file": pdf_upload("full.pdf"),
                "blinded_file": pdf_upload("blinded.pdf"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        submission = Submission.objects.get(title="Submission with blinded manuscript")
        self.assertEqual(submission.versions.count(), 1)

        version = submission.versions.get(version_number=1)
        self.assertEqual(version.file, full_object_name)
        self.assertEqual(version.blinded_file, blinded_object_name)

        self.assertEqual(storage_class.return_value.upload.call_count, 2)
        storage_class.return_value.upload.assert_has_calls(
            [
                call(
                    file_obj=ANY,
                    submission_id=str(submission.id),
                    version_number=1,
                    filename="full.pdf",
                    variant="full",
                ),
                call(
                    file_obj=ANY,
                    submission_id=str(submission.id),
                    version_number=1,
                    filename="blinded.pdf",
                    variant="blinded",
                ),
            ]
        )

    @patch("apps.submissions.services.StorageService")
    def test_submission_create_rejects_missing_blinded_file(self, storage_class):
        self.client.force_authenticate(self.author)

        response = self.client.post(
            self.url,
            {
                "title": "Submission missing blinded file",
                "abstract": "A detailed research abstract.",
                "language": "en",
                "section": str(self.section.id),
                "file": pdf_upload("full.pdf"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("blinded_file", response.data)
        self.assertFalse(Submission.objects.filter(title="Submission missing blinded file").exists())
        storage_class.return_value.upload.assert_not_called()

    def test_non_author_cannot_create_submission(self):
        self.client.force_authenticate(self.reviewer)

        response = self.client.post(
            self.url,
            {
                "title": "Unauthorized submission",
                "abstract": "A detailed research abstract.",
                "language": "en",
                "section": str(self.section.id),
                "file": pdf_upload("full.pdf"),
                "blinded_file": pdf_upload("blinded.pdf"),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
