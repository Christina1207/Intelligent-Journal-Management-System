from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.core.exceptions import ValidationError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.journals.models import JournalMetadataSettings, Section
from apps.journals.serializers import AssignSectionManagerSerializer
from apps.journals.views import SectionManagementViewSet
from apps.submissions.models import (
    Submission,
    SubmissionTopic,
)

# TODO: is this a joke?
class JournalMetadataSettingsTests(TestCase):
    def test_get_current_creates_and_returns_singleton_settings(self):
        settings = JournalMetadataSettings.get_current()

        self.assertEqual(settings.pk, JournalMetadataSettings.SINGLETON_PK)
        self.assertEqual(settings.journal_title, "Untitled Journal")
        self.assertEqual(settings.default_language, "en")
        self.assertEqual(JournalMetadataSettings.get_current(), settings)

    def test_duplicate_settings_row_is_rejected(self):
        JournalMetadataSettings.objects.create(journal_title="First Journal")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                JournalMetadataSettings.objects.create(journal_title="Second Journal")

        self.assertEqual(JournalMetadataSettings.objects.count(), 1)
    
    def test_priority_weights_cannot_all_be_zero(self):
        settings = JournalMetadataSettings(
            priority_waiting_age_weight=0,
            priority_action_urgency_weight=0,
            priority_reviewer_shortage_weight=0,
            priority_overdue_work_weight=0,
            priority_revision_round_weight=0,
        )

        with self.assertRaises(ValidationError):
            settings.full_clean()

# TODO: there are tests that have to do with section manager that need checking out
class SectionApiTests(APITestCase):
    def setUp(self):
        self.roles = {}
        for role_name, _ in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(name=role_name)
            self.roles[role_name] = role

        self.eic = self._create_user(
            username="editor-in-chief",
            role_name=Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.section_manager = self._create_user(
            username="section-manager",
            role_name=Role.RoleName.SECTION_MANAGER,
        )
        self.other_section_manager = self._create_user(
            username="other-section-manager",
            role_name=Role.RoleName.SECTION_MANAGER,
        )
        self.author = self._create_user(
            username="author",
            role_name=Role.RoleName.AUTHOR,
        )
        self.inactive_section_manager = self._create_user(
            username="inactive-section-manager",
            role_name=Role.RoleName.SECTION_MANAGER,
            is_active=False,
        )

    def _create_user(self,*,username,role_name,is_active=True,
    ):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
            is_active=is_active,
        )
        user.roles.add(self.roles[role_name])
        return user

    def _management_detail_url(self, section):
        return reverse("section-management-detail", args=[section.id])

    def _assign_manager_url(self, section):
        return reverse("section-management-assign-manager", args=[section.id])

    def _deactivate_url(self, section):
        return reverse("section-management-deactivate", args=[section.id])

    def _activate_url(self, section):
        return reverse("section-management-activate", args=[section.id])

    def _response_results(self, response):
        if isinstance(response.data, dict) and "results" in response.data:
            return response.data["results"]
        return response.data

    def _response_section_names(self, response):
        return [section["name"] for section in self._response_results(response)]

    def test_public_section_list_returns_only_active_sections(self):
        active_section = Section.objects.create(name="Active Section")
        Section.objects.create(name="Inactive Section", is_active=False)
        self.client.force_authenticate(self.author)

        response = self.client.get(reverse("section-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._response_section_names(response), [active_section.name])

    def test_eic_can_create_section(self):
        self.client.force_authenticate(self.eic)
        payload = {
            "name": "Artificial Intelligence",
            "description": "AI-assisted editorial workflows.",
            "issn": "1234-5678",
        }

        response = self.client.post(
            reverse("section-management-list"),
            payload,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Section.objects.filter(
                name=payload["name"],
                description=payload["description"],
                issn=payload["issn"],
            ).exists()
        )

    def test_non_eic_cannot_create_section(self):
        for user in [self.section_manager, self.author]:
            with self.subTest(username=user.username):
                self.client.force_authenticate(user)

                response = self.client.post(
                    reverse("section-management-list"),
                    {
                        "name": f"Forbidden Section {user.username}",
                        "description": "Should not be created.",
                    },
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_eic_can_assign_active_section_manager(self):
        section = Section.objects.create(name="Machine Learning")
        self.client.force_authenticate(self.eic)

        response = self.client.post(
            self._assign_manager_url(section),
            {"manager_id": str(self.section_manager.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertEqual(section.manager, self.section_manager)

    def test_cannot_assign_user_without_section_manager_role(self):
        section = Section.objects.create(name="Research Ethics")
        self.client.force_authenticate(self.eic)

        response = self.client.post(
            self._assign_manager_url(section),
            {"manager_id": str(self.author.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_assign_inactive_section_manager(self):
        section = Section.objects.create(name="Digital Publishing")
        self.client.force_authenticate(self.eic)

        response = self.client.post(
            self._assign_manager_url(section),
            {"manager_id": str(self.inactive_section_manager.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_manager_action_uses_dedicated_request_serializer(self):
        view = SectionManagementViewSet()
        view.action = "assign_manager"

        self.assertIs(view.get_serializer_class(), AssignSectionManagerSerializer)

    def test_non_eic_cannot_assign_section_manager(self):
        section = Section.objects.create(name="Semantic Matching")

        for user in [self.section_manager, self.author]:
            with self.subTest(username=user.username):
                self.client.force_authenticate(user)

                response = self.client.post(
                    self._assign_manager_url(section),
                    {"manager_id": str(self.other_section_manager.id)},
                    format="json",
                )

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_eic_can_update_any_section(self):
        section = Section.objects.create(name="Old Section", description="Old")
        self.client.force_authenticate(self.eic)

        response = self.client.patch(
            self._management_detail_url(section),
            {
                "name": "Updated Section",
                "description": "Updated description.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertEqual(section.name, "Updated Section")
        self.assertEqual(section.description, "Updated description.")

    def test_assigned_section_manager_can_update_own_section(self):
        section = Section.objects.create(
            name="Managed Section",
            manager=self.section_manager,
        )
        self.client.force_authenticate(self.section_manager)

        response = self.client.patch(
            self._management_detail_url(section),
            {"description": "Managed section description."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertEqual(section.description, "Managed section description.")

    def test_section_manager_cannot_update_other_section(self):
        section = Section.objects.create(
            name="Other Managed Section",
            manager=self.section_manager,
        )
        self.client.force_authenticate(self.other_section_manager)

        response = self.client.patch(
            self._management_detail_url(section),
            {"description": "Unauthorized change."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        section.refresh_from_db()
        self.assertNotEqual(section.description, "Unauthorized change.")

    def test_section_manager_cannot_update_is_active(self):
        section = Section.objects.create(
            name="Active Managed Section",
            manager=self.section_manager,
            is_active=True,
        )
        self.client.force_authenticate(self.section_manager)

        response = self.client.patch(
            self._management_detail_url(section),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        section.refresh_from_db()
        self.assertTrue(section.is_active)

    def test_eic_can_deactivate_section_with_submissions(self):
        section = Section.objects.create(name="Protected Section")
        Submission.objects.create(
            title="Protected Section Submission",
            abstract="A manuscript linked to the section.",
            language="en",
            author=self.author,
            section=section,
        )
        self.client.force_authenticate(self.eic)

        response = self.client.post(self._deactivate_url(section))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertFalse(section.is_active)
        self.assertTrue(Section.objects.filter(id=section.id).exists())

    def test_eic_can_deactivate_section_without_submissions(self):
        section = Section.objects.create(name="Empty Section")
        self.client.force_authenticate(self.eic)

        response = self.client.post(self._deactivate_url(section))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertFalse(section.is_active)
        self.assertTrue(Section.objects.filter(id=section.id).exists())

    def test_non_eic_cannot_deactivate_section(self):
        section = Section.objects.create(
            name="Non EIC Deactivate Section",
            manager=self.section_manager,
        )
        self.client.force_authenticate(self.section_manager)

        response = self.client.post(self._deactivate_url(section))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Section.objects.filter(id=section.id).exists())

    def test_eic_can_activate_section(self):
        section = Section.objects.create(name="Inactive Section", is_active=False)
        self.client.force_authenticate(self.eic)

        response = self.client.post(self._activate_url(section))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        section.refresh_from_db()
        self.assertTrue(section.is_active)

    def test_non_eic_cannot_activate_section(self):
        section = Section.objects.create(
            name="Non EIC Activate Section",
            manager=self.section_manager,
            is_active=False,
        )
        self.client.force_authenticate(self.section_manager)

        response = self.client.post(self._activate_url(section))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        section.refresh_from_db()
        self.assertFalse(section.is_active)

    def test_management_list_does_not_expose_all_sections_to_normal_users(self):
        Section.objects.create(name="Visible Only To Management")
        self.client.force_authenticate(self.author)

        response = self.client.get(reverse("section-management-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_section_manager_management_list_only_returns_owned_sections(self):
        owned_section = Section.objects.create(
            name="Owned Section",
            manager=self.section_manager,
        )
        Section.objects.create(
            name="Other Manager Section",
            manager=self.other_section_manager,
        )
        Section.objects.create(name="Unmanaged Section")
        self.client.force_authenticate(self.section_manager)

        response = self.client.get(reverse("section-management-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._response_section_names(response), [owned_section.name])

class SectionTopicAnalyticsApiTests(APITestCase):
    def setUp(self):
        self.roles = {}

        for role_name, _label in Role.RoleName.choices:
            role, _ = Role.objects.get_or_create(
                name=role_name
            )
            self.roles[role_name] = role

        self.eic = self._create_user(
            "analytics-eic",
            Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.manager = self._create_user(
            "analytics-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.other_manager = self._create_user(
            "other-analytics-manager",
            Role.RoleName.SECTION_MANAGER,
        )
        self.author = self._create_user(
            "analytics-author",
            Role.RoleName.AUTHOR,
        )

        self.section = Section.objects.create(
            name="Medical Analytics",
            manager=self.manager,
        )
        self.other_section = Section.objects.create(
            name="Engineering Analytics",
            manager=self.other_manager,
        )

        self.url = reverse(
            "section-topic-analytics"
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
        keywords,
        topic_label="",
        topic_keywords=None,
        create_topic=True,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract=(
                "A sufficiently detailed scientific abstract."
            ),
            keywords=keywords,
            language="en",
            author=self.author,
            section=self.section,
        )

        if create_topic:
            SubmissionTopic.objects.create(
                submission=submission,
                label=topic_label or None,
                keywords=topic_keywords or [],
            )

        return submission

    def _section_result(self, response, section_id):
        return next(
            item
            for item in response.data["sections"]
            if item["section"]["id"] == str(section_id)
        )

    def test_manager_sees_only_managed_sections(self):
        self.client.force_authenticate(self.manager)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            [
                section["section"]["id"]
                for section in response.data["sections"]
            ],
            [str(self.section.id)],
        )

    def test_eic_sees_all_active_sections(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertSetEqual(
            {
                section["section"]["id"]
                for section in response.data["sections"]
            },
            {
                str(self.section.id),
                str(self.other_section.id),
            },
        )

    def test_author_cannot_view_topic_analytics(self):
        self.client.force_authenticate(self.author)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_topic_aggregates_are_counted_without_private_data(self):
        self._create_submission(
            title="Prevention A",
            keywords=[
                "Prevention",
                "Public Health",
            ],
            topic_label="Drug Prevention",
            topic_keywords=[
                "prevention",
                "medicine",
            ],
        )
        self._create_submission(
            title="Prevention B",
            keywords=[
                "prevention",
                "Pediatrics",
            ],
            topic_label="Drug Prevention",
            topic_keywords=[
                "prevention",
                "medicine",
            ],
        )
        self._create_submission(
            title="Clinical Study",
            keywords=[
                "Clinical Research",
            ],
            topic_label="Clinical Research",
            topic_keywords=[
                "clinical",
                "research",
            ],
        )
        self._create_submission(
            title="Topic Outlier",
            keywords=["Rare Disease"],
            topic_label="",
            topic_keywords=[],
        )
        self._create_submission(
            title="Pending Analysis",
            keywords=["Epidemiology"],
            create_topic=False,
        )

        self.client.force_authenticate(self.manager)

        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        section = self._section_result(
            response,
            self.section.id,
        )

        self.assertEqual(
            section["total_submissions"],
            5,
        )
        self.assertEqual(
            section["analyzed_submissions"],
            4,
        )
        self.assertEqual(
            section["clustered_submissions"],
            3,
        )
        self.assertEqual(
            section["outlier_submissions"],
            1,
        )
        self.assertEqual(
            section["pending_analysis"],
            1,
        )

        drug_topic = next(
            topic
            for topic in section["topics"]
            if topic["label"] == "Drug Prevention"
        )

        self.assertEqual(
            drug_topic["submission_count"],
            2,
        )
        self.assertEqual(
            drug_topic["percentage_of_clustered"],
            66.7,
        )
        self.assertIn(
            "prevention",
            [
                keyword.casefold()
                for keyword in drug_topic["keywords"]
            ],
        )

        prevention_keyword = next(
            keyword
            for keyword in section[
                "top_author_keywords"
            ]
            if keyword["keyword"].casefold()
            == "prevention"
        )

        self.assertEqual(
            prevention_keyword["submission_count"],
            2,
        )

        serialized = str(response.data)

        self.assertNotIn("Prevention A", serialized)
        self.assertNotIn("analytics-author", serialized)
        self.assertNotIn(
            "A sufficiently detailed scientific abstract",
            serialized,
        )