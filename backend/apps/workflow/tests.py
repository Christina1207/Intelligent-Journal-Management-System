from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role
from apps.journals.models import Section, SectionEditorMembership
from apps.reviews.services import ReviewService
from apps.submissions.models import Submission, SubmissionVersion
from apps.workflow.models import ReviewerAssignment, SubmissionAssignment, TriageAssessment
from apps.workflow.constants import get_triage_checklist


class ManagerAssignmentApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.manager = self.create_user(
            "manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.other_manager = self.create_user(
            "other-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.author = self.create_user("author", Role.RoleName.AUTHOR)
        self.eligible_editor = self.create_user(
            "eligible-editor",
            Role.RoleName.SECTION_EDITOR,
        )
        self.other_section_editor = self.create_user(
            "other-editor",
            Role.RoleName.SECTION_EDITOR,
        )

        self.section = Section.objects.create(
            name="Computer Science",
            manager=self.manager,
        )
        self.other_section = Section.objects.create(
            name="Physics",
            manager=self.other_manager,
        )

        SectionEditorMembership.objects.create(
            section=self.section,
            editor=self.eligible_editor,
            created_by=self.manager,
        )
        SectionEditorMembership.objects.create(
            section=self.other_section,
            editor=self.other_section_editor,
            created_by=self.other_manager,
        )

        self.submission = self.create_submission(
            title="Managed manuscript",
            section=self.section,
        )
        self.complete_triage(self.submission)
        self.other_submission = self.create_submission(
            title="Other manuscript",
            section=self.other_section,
        )

    def create_user(self, username, role):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )
        user.roles.add(self.roles[role])
        return user

    def create_submission(self, *, title, section):
        submission = Submission.objects.create(
            title=title,
            abstract="Research abstract.",
            language="en",
            author=self.author,
            section=section,
        )
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=1,
            file=f"submissions/{submission.id}/v1/manuscript.pdf",
        )
        return submission
    def complete_triage(self, submission):
        version = submission.versions.order_by(
            "-version_number"
        ).first()

        checks = {
            definition["code"]: {
                "result": "PASS",
                "note": "",
            }
            for definition in get_triage_checklist()
            if definition["required"]
        }

        return TriageAssessment.objects.create(
            submission_version=version,
            checks=checks,
            status=TriageAssessment.Status.COMPLETED,
            outcome=TriageAssessment.Outcome.PROCEED,
            created_by=self.manager,
            completed_by=self.manager,
            completed_at=timezone.now(),
        )

    def test_manager_queue_requires_section_manager_role(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(reverse("manager-queue"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_queue_contains_only_managed_section(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get(reverse("manager-queue"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {
            item["id"]
            for item in response.data["results"]
        }
        self.assertEqual(returned_ids, {str(self.submission.id)})

    def test_manager_can_assign_eligible_section_editor(self):
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse("manager-assign-editor", args=[self.submission.id]),
            {"editor_id": str(self.eligible_editor.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.submission.refresh_from_db()
        self.assertEqual(
            self.submission.assigned_editor_id,
            self.eligible_editor.id,
        )
        self.assertEqual(
            self.submission.status,
            Submission.Status.ASSIGNED,
        )

        self.assertTrue(
            SubmissionAssignment.objects.filter(
                submission=self.submission,
                assigned_to=self.eligible_editor,
                assigned_by=self.manager,
            ).exists()
        )

    def test_manager_cannot_assign_editor_from_another_section(self):
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse("manager-assign-editor", args=[self.submission.id]),
            {"editor_id": str(self.other_section_editor.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.submission.refresh_from_db()
        self.assertIsNone(self.submission.assigned_editor)

    def test_manager_cannot_assign_submission_from_another_section(self):
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "manager-assign-editor",
                args=[self.other_submission.id],
            ),
            {"editor_id": str(self.eligible_editor.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_assign_editor_before_triage_completion(self):
        submission = self.create_submission(
            title="Untriaged manuscript",
            section=self.section,
        )

        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "manager-assign-editor",
                args=[submission.id],
            ),
            {"editor_id": str(self.eligible_editor.id)},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("triage", response.data)

    def test_eligible_editors_are_limited_to_submission_section(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get(
            reverse(
                "manager-eligible-editors",
                args=[self.submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        returned_ids = {
            editor["id"]
            for editor in response.data
        }

        self.assertIn(
            str(self.eligible_editor.id),
            returned_ids,
        )
        self.assertNotIn(
            str(self.other_section_editor.id),
            returned_ids,
        )


    def test_eligible_editor_response_includes_workload(self):
        self.client.force_authenticate(self.manager)

        assignment_response = self.client.post(
            reverse(
                "manager-assign-editor",
                args=[self.submission.id],
            ),
            {
                "editor_id": str(self.eligible_editor.id),
            },
            format="json",
        )

        self.assertEqual(
            assignment_response.status_code,
            status.HTTP_201_CREATED,
        )

        response = self.client.get(
            reverse(
                "manager-eligible-editors",
                args=[self.submission.id],
            )
        )

        editor_data = next(
            editor
            for editor in response.data
            if editor["id"] == str(self.eligible_editor.id)
        )

        self.assertEqual(
            editor_data["active_assignment_count"],
            1,
        )
        self.assertTrue(editor_data["is_current_editor"])


    def test_manager_cannot_list_editors_for_unmanaged_submission(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get(
            reverse(
                "manager-eligible-editors",
                args=[self.other_submission.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

class ReviewerAssignmentRegressionTests(APITestCase):
    def setUp(self):
        reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER
        )
        author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR
        )

        user_model = get_user_model()

        self.author = user_model.objects.create_user(
            username="author",
            email="author@example.com",
            password="testpass123",
        )
        self.author.roles.add(author_role)

        self.reviewer = user_model.objects.create_user(
            username="reviewer",
            email="reviewer@example.com",
            password="testpass123",
        )
        self.reviewer.roles.add(reviewer_role)

        self.section = Section.objects.create(name="Computer Science")
        self.submission = Submission.objects.create(
            title="Manuscript",
            abstract="Abstract",
            language="en",
            author=self.author,
            section=self.section,
        )
        self.version = SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/test/v1/manuscript.pdf",
        )

    def test_reviewer_can_decline_without_unbound_local_error(self):
        assignment = ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=self.reviewer,
            assigned_by=self.author,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=timezone.now() + timedelta(days=2),
            review_deadline=timezone.now() + timedelta(days=10),
        )

        result = ReviewService.respond_to_assignment(
            reviewer=self.reviewer,
            assignment=assignment,
            accept=False,
        )

        self.assertEqual(
            result.status,
            ReviewerAssignment.Status.DECLINED,
        )

    def test_accepted_assignment_reports_overdue(self):
        assignment = ReviewerAssignment.objects.create(
            version=self.version,
            reviewer=self.reviewer,
            assigned_by=self.author,
            status=ReviewerAssignment.Status.ACCEPTED,
            response_deadline=timezone.now() - timedelta(days=10),
            review_deadline=timezone.now() - timedelta(days=1),
        )

        self.assertTrue(assignment.is_overdue)