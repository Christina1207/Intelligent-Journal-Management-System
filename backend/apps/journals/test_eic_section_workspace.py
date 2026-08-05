from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import Role


User = get_user_model()


class SectionManagerCandidateApiTests(APITestCase):
    def setUp(self):
        self.eic_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.manager_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_MANAGER,
        )
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )

        self.eic = self._create_user("eic")
        self.eic.roles.add(self.eic_role)

        self.manager = self._create_user("eligible-manager")
        self.manager.roles.add(self.manager_role)

        self.inactive_manager = self._create_user(
            "inactive-manager",
            is_active=False,
        )
        self.inactive_manager.roles.add(self.manager_role)

        self.author = self._create_user("ordinary-author")
        self.author.roles.add(self.author_role)

        self.url = reverse("section-manager-candidate-list")

    @staticmethod
    def _create_user(username, *, is_active=True):
        return User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
            first_name=username.replace("-", " ").title(),
            last_name="User",
            is_active=is_active,
        )

    def test_eic_sees_only_active_users_with_section_manager_role(self):
        self.client.force_authenticate(self.eic)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(
            response.data[0]["id"],
            str(self.manager.id),
        )
        self.assertEqual(
            response.data[0]["full_name"],
            self.manager.get_full_name(),
        )

        returned_ids = {
            candidate["id"] for candidate in response.data
        }
        self.assertNotIn(str(self.inactive_manager.id), returned_ids)
        self.assertNotIn(str(self.author.id), returned_ids)

    def test_non_eic_cannot_list_manager_candidates(self):
        for user in [self.manager, self.author]:
            with self.subTest(username=user.username):
                self.client.force_authenticate(user)

                response = self.client.get(self.url)

                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_unauthenticated_user_cannot_list_manager_candidates(self):
        response = self.client.get(self.url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
