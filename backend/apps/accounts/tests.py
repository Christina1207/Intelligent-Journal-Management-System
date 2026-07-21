from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from django.test import TestCase
from rest_framework.test import APITestCase
from drf_spectacular.generators import SchemaGenerator

from apps.accounts.models import Role, User,ReviewerProfile

class DefaultRoleBootstrapTests(TestCase):
    def test_migrations_create_all_default_roles(self):
        actual_roles = set(
            Role.objects.values_list("name", flat=True)
        )
        expected_roles = set(Role.RoleName.values)

        self.assertSetEqual(actual_roles, expected_roles)

class UserActivationApiTests(APITestCase):
    def setUp(self):
        self.username = "activation-user"
        self.password = "testpass123"
        self.user = get_user_model().objects.create_user(
            username=self.username,
            email="activation@example.com",
            password=self.password,
        )
        self.login_url = reverse("auth-login")
        self.me_url = reverse("auth-me")

    def login(self):
        return self.client.post(
            self.login_url,
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
        )

    def test_active_user_can_login(self):
        response = self.login()

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_inactive_user_cannot_login(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        response = self.login()

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_existing_access_token_is_rejected_after_deactivation(self):
        login_response = self.login()
        access_token = login_response.data["access"]

        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}"
        )
        response = self.client.get(self.me_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_profile_keeps_status_api_contract(self):
        login_response = self.login()

        self.client.credentials(
            HTTP_AUTHORIZATION=(
                f"Bearer {login_response.data['access']}"
            )
        )
        response = self.client.get(self.me_url)

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(response.data["status"], "ACTIVE")

class CurrentUserProfileApiTests(APITestCase):
    def setUp(self):
        self.url = reverse("auth-me")
        self.user = get_user_model().objects.create_user(
            username="christina",
            email="christina@example.com",
            password="testpass123",
            first_name="Old",
            last_name="Name",
            orcid="",
            affiliation="Old University",
            country="Lebanon",
        )

    def authenticate(self):
        self.client.force_authenticate(self.user)

    def test_current_user_patch_requires_authentication(self):
        response = self.client.patch(
            self.url,
            {"first_name": "Christina"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_can_update_allowed_profile_fields(self):
        self.authenticate()
        payload = {
            "first_name": "Christina",
            "last_name": "Khiami",
            "orcid": "0000-0000-0000-0000",
            "affiliation": "University Name",
            "country": "Syria",
        }

        response = self.client.patch(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, payload["first_name"])
        self.assertEqual(self.user.last_name, payload["last_name"])
        self.assertEqual(self.user.orcid, payload["orcid"])
        self.assertEqual(self.user.affiliation, payload["affiliation"])
        self.assertEqual(self.user.country, payload["country"])
        self.assertEqual(response.data["first_name"], payload["first_name"])
        self.assertEqual(response.data["email"], "christina@example.com")
        self.assertIn("roles", response.data)

    def test_current_user_patch_supports_partial_updates(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"affiliation": "Updated University"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Old")
        self.assertEqual(self.user.last_name, "Name")
        self.assertEqual(self.user.affiliation, "Updated University")

    def test_current_user_patch_rejects_invalid_orcid(self):
        self.authenticate()

        response = self.client.patch(
            self.url,
            {"orcid": "not-an-orcid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.orcid, "")

    def test_current_user_patch_rejects_sensitive_fields(self):
        reviewer_role, _ = Role.objects.get_or_create(name=Role.RoleName.REVIEWER)
        original_password_hash = self.user.password
        disallowed_payloads = {
            "roles": [reviewer_role.id],
            "status": User.Status.INACTIVE,
            "is_staff": True,
            "is_superuser": True,
            "password": "newpass123",
            "email": "changed@example.com",
            "username": "changed-username",
        }

        for field, value in disallowed_payloads.items():
            with self.subTest(field=field):
                self.authenticate()

                response = self.client.patch(self.url, {field: value}, format="json")

                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)
                self.user.refresh_from_db()
                self.assertEqual(self.user.username, "christina")
                self.assertEqual(self.user.email, "christina@example.com")
                self.assertEqual(self.user.status, User.Status.ACTIVE)
                self.assertTrue(self.user.is_active)
                self.assertFalse(self.user.is_staff)
                self.assertFalse(self.user.is_superuser)
                self.assertEqual(self.user.password, original_password_hash)
                self.assertFalse(self.user.roles.filter(id=reviewer_role.id).exists())

class ReviewerProfileApiTests(APITestCase):
    def setUp(self):
        self.reviewer_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.REVIEWER,
        )
        self.author_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.AUTHOR,
        )

        self.reviewer = get_user_model().objects.create_user(
            username="profile-reviewer",
            email="profile-reviewer@example.com",
            password="testpass123",
        )
        self.reviewer.roles.add(self.reviewer_role)

        self.url = reverse("reviewer-profile-update")

    def test_profile_patch_creates_missing_reviewer_profile(self):
        self.assertFalse(
            ReviewerProfile.objects.filter(
                user=self.reviewer,
            ).exists()
        )

        self.client.force_authenticate(self.reviewer)

        response = self.client.patch(
            self.url,
            {
                "keywords": [
                    "Machine Learning",
                    "machine learning",
                    "Scientific Publishing",
                    "Reviewer Recommendation",
                ],
                "biography": (
                    "Researcher in explainable editorial intelligence."
                ),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        profile = ReviewerProfile.objects.get(
            user=self.reviewer,
        )

        self.assertEqual(
            profile.keywords,
            [
                "Machine Learning",
                "Scientific Publishing",
                "Reviewer Recommendation",
            ],
        )
        self.assertEqual(
            profile.sync_status,
            ReviewerProfile.SyncStatus.PENDING,
        )
        self.assertIsNone(profile.expertise_embedding)
        self.assertIsNone(profile.last_synced_at)

    def test_non_reviewer_cannot_create_reviewer_profile(self):
        author = get_user_model().objects.create_user(
            username="profile-author",
            email="profile-author@example.com",
            password="testpass123",
        )
        author.roles.add(self.author_role)

        self.client.force_authenticate(author)

        response = self.client.patch(
            self.url,
            {
                "keywords": [
                    "Machine Learning",
                    "Scientific Publishing",
                    "Peer Review",
                ],
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertFalse(
            ReviewerProfile.objects.filter(user=author).exists()
        )

    def test_reviewer_profile_patch_is_documented_in_openapi_schema(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)
        operation = schema["paths"]["/api/v1/auth/reviewer/profile/"]["patch"]

        self.assertEqual(operation["tags"], ["Auth"])
        self.assertIn("requestBody", operation)
        self.assertIn("200", operation["responses"])