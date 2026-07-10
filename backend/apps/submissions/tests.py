from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.journals.models import Section
from apps.submissions.models import Submission, SubmissionVersion


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
            decision=SubmissionVersion.Decision.MINOR_REVISION,
            decision_letter="Please revise.",
        )
        self.version_two = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=2,
            file="submissions/private/v2/manuscript.pdf",
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
            "decided_at",
            "decided_by",
            "reviewer",
            "reviewers",
        }

        for field in forbidden_top_level_fields:
            self.assertNotIn(field, response.data)

        for field in forbidden_version_fields:
            self.assertNotIn(field, response.data["latest_version"])
