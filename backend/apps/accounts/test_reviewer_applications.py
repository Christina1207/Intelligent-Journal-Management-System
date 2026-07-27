from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.recommendations import RecommendationService
from apps.journals.models import Section
from apps.submissions.models import Submission

from .models import (
    ReviewerApplication,
    ReviewerProfile,
    Role,
)
from .services import ReviewerApplicationService


User = get_user_model()


class ReviewerApplicationApiTests(APITestCase):
    def setUp(self):
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )
        self.reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER,
        )
        self.eic_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.section_manager_role, _ = (
            Role.objects.get_or_create(
                name=Role.RoleName.SECTION_MANAGER,
            )
        )

        self.section = Section.objects.create(
            name="Artificial Intelligence",
            description="Artificial intelligence research.",
        )
        self.other_section = Section.objects.create(
            name="Data Science",
            description="Data science research.",
        )

        self.applicant = self._create_user(
            username="reviewer-applicant",
            email="applicant@example.com",
        )
        self.applicant.roles.add(self.author_role)

        self.eic = self._create_user(
            username="editor-in-chief",
            email="eic@example.com",
        )
        self.eic.roles.add(self.eic_role)

        self.section_manager = self._create_user(
            username="section-manager",
            email="manager@example.com",
        )
        self.section_manager.roles.add(
            self.section_manager_role
        )

        self.regular_author = self._create_user(
            username="regular-author",
            email="author@example.com",
        )
        self.regular_author.roles.add(self.author_role)

        self.application_url = reverse(
            "reviewer-application"
        )
        self.application_list_url = reverse(
            "reviewer-application-list"
        )

        self.valid_payload = {
            "section_id": str(self.section.id),
            "keywords": [
                "Machine Learning",
                "Natural Language Processing",
                "Reviewer Recommendation",
            ],
            "biography": (
                "Researcher specializing in machine learning, "
                "natural language processing, information retrieval, "
                "and intelligent scientific publishing systems."
            ),
        }

    @staticmethod
    def _create_user(*, username, email):
        return User.objects.create_user(
            username=username,
            email=email,
            password="testpass123",
            first_name="Test",
            last_name="Researcher",
            affiliation="Example University",
            country="Syria",
        )

    def _create_application(
        self,
        *,
        user=None,
        status_value=ReviewerApplication.Status.PENDING,
    ):
        return ReviewerApplication.objects.create(
            user=user or self.applicant,
            section=self.section,
            keywords=[
                "Machine Learning",
                "Natural Language Processing",
                "Reviewer Recommendation",
            ],
            biography=(
                "Researcher specializing in machine learning, "
                "natural language processing, information retrieval, "
                "and scientific publishing workflows."
            ),
            status=status_value,
        )

    def test_unauthenticated_user_cannot_submit(self):
        response = self.client.post(
            self.application_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertFalse(
            ReviewerApplication.objects.exists()
        )

    def test_author_can_submit_single_section_application(self):
        self.client.force_authenticate(self.applicant)

        response = self.client.post(
            self.application_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_201_CREATED,
        )

        application = ReviewerApplication.objects.get(
            user=self.applicant,
        )

        self.assertEqual(
            application.section,
            self.section,
        )
        self.assertEqual(
            application.status,
            ReviewerApplication.Status.PENDING,
        )
        self.assertEqual(
            application.keywords,
            self.valid_payload["keywords"],
        )
        self.assertEqual(
            response.data["section"]["id"],
            str(self.section.id),
        )

    def test_application_rejects_multi_section_payload(self):
        self.client.force_authenticate(self.applicant)

        payload = {
            **self.valid_payload,
            "requested_section_ids": [
                str(self.section.id),
                str(self.other_section.id),
            ],
        }

        response = self.client.post(
            self.application_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "requested_section_ids",
            response.data,
        )

    def test_user_cannot_create_duplicate_application(self):
        self._create_application()
        self.client.force_authenticate(self.applicant)

        response = self.client.post(
            self.application_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            ReviewerApplication.objects.filter(
                user=self.applicant,
            ).count(),
            1,
        )

    def test_existing_reviewer_cannot_apply(self):
        self.applicant.roles.add(self.reviewer_role)
        self.client.force_authenticate(self.applicant)

        response = self.client.post(
            self.application_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_application_requires_active_section(self):
        self.section.is_active = False
        self.section.save(update_fields=["is_active"])

        self.client.force_authenticate(self.applicant)

        response = self.client.post(
            self.application_url,
            self.valid_payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("section_id", response.data)

    def test_application_validates_distinct_keywords(self):
        self.client.force_authenticate(self.applicant)

        payload = {
            **self.valid_payload,
            "keywords": [
                "Machine Learning",
                " machine   learning ",
                "Peer Review",
            ],
        }

        response = self.client.post(
            self.application_url,
            payload,
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("keywords", response.data)

    def test_user_can_only_retrieve_own_application(self):
        application = self._create_application()
        self.client.force_authenticate(self.applicant)

        response = self.client.get(
            self.application_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            response.data["id"],
            str(application.id),
        )
        self.assertEqual(
            response.data["applicant"]["id"],
            str(self.applicant.id),
        )

    def test_get_returns_not_found_without_application(self):
        self.client.force_authenticate(self.applicant)

        response = self.client.get(
            self.application_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_rejected_application_can_be_resubmitted(self):
        application = self._create_application(
            status_value=ReviewerApplication.Status.REJECTED,
        )
        application.decision_note = "Provide better expertise."
        application.reviewed_by = self.eic
        application.reviewed_at = timezone.now()
        application.save()

        self.client.force_authenticate(self.applicant)

        response = self.client.patch(
            self.application_url,
            {
                "section_id": str(self.other_section.id),
                "biography": (
                    "Updated academic biography describing extensive "
                    "research experience in data science, statistics, "
                    "machine learning, and scholarly peer review."
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        application.refresh_from_db()

        self.assertEqual(
            application.status,
            ReviewerApplication.Status.PENDING,
        )
        self.assertEqual(
            application.section,
            self.other_section,
        )
        self.assertEqual(application.decision_note, "")
        self.assertIsNone(application.reviewed_by)
        self.assertIsNone(application.reviewed_at)

    def test_approved_application_cannot_be_edited(self):
        self._create_application(
            status_value=ReviewerApplication.Status.APPROVED,
        )
        self.client.force_authenticate(self.applicant)

        response = self.client.patch(
            self.application_url,
            {
                "biography": (
                    "This attempted update contains enough characters "
                    "but must be rejected because approval is terminal."
                )
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_eic_can_list_and_filter_pending_applications(self):
        pending_application = self._create_application()

        rejected_user = self._create_user(
            username="rejected-user",
            email="rejected@example.com",
        )
        rejected_user.roles.add(self.author_role)

        self._create_application(
            user=rejected_user,
            status_value=ReviewerApplication.Status.REJECTED,
        )

        self.client.force_authenticate(self.eic)

        response = self.client.get(
            self.application_list_url,
            {"status": "PENDING"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["id"],
            str(pending_application.id),
        )

    def test_regular_author_cannot_list_applications(self):
        self.client.force_authenticate(self.regular_author)

        response = self.client.get(
            self.application_list_url,
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_section_manager_cannot_approve_application(self):
        application = self._create_application()

        self.client.force_authenticate(
            self.section_manager
        )

        response = self.client.post(
            reverse(
                "reviewer-application-approve",
                kwargs={
                    "application_id": application.id,
                },
            ),
            {},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    @patch(
        "apps.accounts.tasks."
        "generate_reviewer_expertise_embedding.delay"
    )
    def test_approval_creates_complete_reviewer_identity(
        self,
        embedding_task,
    ):
        application = self._create_application()
        self.client.force_authenticate(self.eic)

        with self.captureOnCommitCallbacks(
            execute=True
        ):
            response = self.client.post(
                reverse(
                    "reviewer-application-approve",
                    kwargs={
                        "application_id": application.id,
                    },
                ),
                {
                    "decision_note": (
                        "Approved for the selected section."
                    )
                },
                format="json",
            )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        application.refresh_from_db()
        self.applicant.refresh_from_db()

        self.assertEqual(
            application.status,
            ReviewerApplication.Status.APPROVED,
        )
        self.assertEqual(
            application.reviewed_by,
            self.eic,
        )
        self.assertIsNotNone(application.reviewed_at)

        self.assertTrue(
            self.applicant.has_role(
                Role.RoleName.REVIEWER
            )
        )

        profile = ReviewerProfile.objects.get(
            user=self.applicant,
        )

        self.assertEqual(
            profile.keywords,
            application.keywords,
        )
        self.assertEqual(
            profile.biography,
            application.biography,
        )
        self.assertEqual(
            list(profile.sections.all()),
            [self.section],
        )
        self.assertEqual(
            profile.sync_status,
            ReviewerProfile.SyncStatus.PENDING,
        )
        self.assertIsNone(profile.expertise_embedding)
        self.assertIsNone(profile.last_synced_at)

        embedding_task.assert_called_once_with(
            str(self.applicant.id)
        )

    @patch(
        "apps.accounts.tasks."
        "generate_reviewer_expertise_embedding.delay"
    )
    def test_application_cannot_be_approved_twice(
        self,
        embedding_task,
    ):
        application = self._create_application()
        self.client.force_authenticate(self.eic)

        approve_url = reverse(
            "reviewer-application-approve",
            kwargs={"application_id": application.id},
        )

        with self.captureOnCommitCallbacks(
            execute=True
        ):
            first_response = self.client.post(
                approve_url,
                {},
                format="json",
            )

        second_response = self.client.post(
            approve_url,
            {},
            format="json",
        )

        self.assertEqual(
            first_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            second_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        embedding_task.assert_called_once()

    def test_rejection_requires_reason_and_grants_no_role(self):
        application = self._create_application()
        reject_url = reverse(
            "reviewer-application-reject",
            kwargs={"application_id": application.id},
        )

        self.client.force_authenticate(self.eic)

        missing_reason_response = self.client.post(
            reject_url,
            {"decision_note": "   "},
            format="json",
        )

        self.assertEqual(
            missing_reason_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        response = self.client.post(
            reject_url,
            {
                "decision_note": (
                    "Please provide more specific expertise."
                )
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        application.refresh_from_db()
        self.applicant.refresh_from_db()

        self.assertEqual(
            application.status,
            ReviewerApplication.Status.REJECTED,
        )
        self.assertEqual(
            application.decision_note,
            "Please provide more specific expertise.",
        )
        self.assertFalse(
            self.applicant.has_role(
                Role.RoleName.REVIEWER
            )
        )
        self.assertFalse(
            ReviewerProfile.objects.filter(
                user=self.applicant,
            ).exists()
        )


class ReviewerApplicationRecommendationTests(
    APITestCase
):
    def setUp(self):
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )
        self.eic_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.EDITOR_IN_CHIEF,
        )

        self.selected_section = Section.objects.create(
            name="Selected Section",
        )
        self.unapproved_section = Section.objects.create(
            name="Unapproved Section",
        )

        self.applicant = User.objects.create_user(
            username="recommended-reviewer",
            email="recommended@example.com",
            password="testpass123",
            first_name="Recommended",
            last_name="Reviewer",
            affiliation="Example University",
            country="Syria",
        )
        self.applicant.roles.add(self.author_role)

        self.eic = User.objects.create_user(
            username="recommendation-eic",
            email="recommendation-eic@example.com",
            password="testpass123",
        )
        self.eic.roles.add(self.eic_role)

        self.manuscript_author = User.objects.create_user(
            username="manuscript-author",
            email="manuscript-author@example.com",
            password="testpass123",
        )

        self.application = (
            ReviewerApplication.objects.create(
                user=self.applicant,
                section=self.selected_section,
                keywords=[
                    "Machine Learning",
                    "Natural Language Processing",
                    "Peer Review",
                ],
                biography=(
                    "Researcher specializing in machine learning, "
                    "natural language processing, and intelligent "
                    "peer-review support systems."
                ),
            )
        )

    @patch(
        "apps.accounts.tasks."
        "generate_reviewer_expertise_embedding.delay"
    )
    def test_approved_reviewer_is_recommended_only_for_selected_section(
        self,
        embedding_task,
    ):
        with self.captureOnCommitCallbacks(
            execute=True
        ):
            ReviewerApplicationService.approve_application(
                application_id=self.application.id,
                reviewed_by=self.eic,
            )

        selected_submission = Submission.objects.create(
            title="Machine Learning Manuscript",
            abstract=(
                "A study of machine learning methods for "
                "scientific document analysis."
            ),
            keywords=[
                "Machine Learning",
                "Natural Language Processing",
            ],
            language="en",
            author=self.manuscript_author,
            section=self.selected_section,
        )

        unapproved_submission = Submission.objects.create(
            title="Another Machine Learning Manuscript",
            abstract=(
                "A second study of machine learning systems."
            ),
            keywords=[
                "Machine Learning",
                "Natural Language Processing",
            ],
            language="en",
            author=self.manuscript_author,
            section=self.unapproved_section,
        )

        selected_recommendations = (
            RecommendationService.get_recommendations(
                selected_submission,
                limit=10,
            )
        )
        unapproved_recommendations = (
            RecommendationService.get_recommendations(
                unapproved_submission,
                limit=10,
            )
        )

        selected_reviewer_ids = {
            item["reviewer_id"]
            for item in selected_recommendations
        }
        unapproved_reviewer_ids = {
            item["reviewer_id"]
            for item in unapproved_recommendations
        }

        self.assertIn(
            str(self.applicant.id),
            selected_reviewer_ids,
        )
        self.assertNotIn(
            str(self.applicant.id),
            unapproved_reviewer_ids,
        )

        profile = ReviewerProfile.objects.get(
            user=self.applicant,
        )

        self.assertEqual(
            list(
                profile.sections.values_list(
                    "id",
                    flat=True,
                )
            ),
            [self.selected_section.id],
        )