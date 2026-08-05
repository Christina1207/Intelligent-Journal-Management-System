from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.journals.models import Section

from .models import ReviewerApplication, Role


User = get_user_model()


class ReviewerApplicationSectionFilterApiTests(APITestCase):
    def setUp(self):
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )
        self.eic_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.EDITOR_IN_CHIEF,
        )

        self.eic = self._create_user("filter-eic")
        self.eic.roles.add(self.eic_role)

        self.first_section = Section.objects.create(
            name="Artificial Intelligence",
        )
        self.second_section = Section.objects.create(
            name="Medical Informatics",
        )

        first_applicant = self._create_user("first-applicant")
        first_applicant.roles.add(self.author_role)
        second_applicant = self._create_user("second-applicant")
        second_applicant.roles.add(self.author_role)

        self.first_application = self._create_application(
            user=first_applicant,
            section=self.first_section,
        )
        self._create_application(
            user=second_applicant,
            section=self.second_section,
        )

        self.url = reverse("reviewer-application-list")

    @staticmethod
    def _create_user(username):
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name="Test",
            last_name="Researcher",
        )

    @staticmethod
    def _create_application(*, user, section):
        return ReviewerApplication.objects.create(
            user=user,
            section=section,
            keywords=[
                "Machine Learning",
                "Scientific Publishing",
                "Peer Review",
            ],
            biography=(
                "Researcher with sufficient academic experience in "
                "scientific publishing, peer review, and data analysis."
            ),
        )

    def test_eic_can_filter_applications_by_section(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(
            self.url,
            {
                "status": ReviewerApplication.Status.PENDING,
                "section": str(self.first_section.id),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["id"],
            str(self.first_application.id),
        )

    def test_invalid_section_filter_returns_field_error(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(
            self.url,
            {"section": "not-a-uuid"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("section", response.data)
