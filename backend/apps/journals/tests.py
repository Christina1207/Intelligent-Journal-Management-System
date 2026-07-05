from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role, User
from apps.journals.models import Section
from apps.submissions.models import Submission


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
            user_status=User.Status.INACTIVE,
        )

    def _create_user(self, *, username, role_name, user_status=User.Status.ACTIVE):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
            status=user_status,
        )
        user.roles.add(self.roles[role_name])
        return user

    def _management_detail_url(self, section):
        return reverse("section-management-detail", args=[section.id])

    def _assign_manager_url(self, section):
        return reverse("section-management-assign-manager", args=[section.id])

    def _deactivate_url(self, section):
        return reverse("section-management-deactivate", args=[section.id])

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
