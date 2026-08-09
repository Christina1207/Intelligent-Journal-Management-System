from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.journals.models import Issue, Section
from apps.submissions.models import Submission

from .models import PublishedArticle


class ContinuousIssueManagementApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.year = timezone.now().year

        self.eic = self._create_user_with_role(
            username="editor-in-chief",
            role_name=Role.RoleName.EDITOR_IN_CHIEF,
        )
        self.author = self._create_user_with_role(
            username="issue-test-author",
            role_name=Role.RoleName.AUTHOR,
        )
        self.section = Section.objects.create(
            name="Issue Management Test Section",
        )

    def _create_user_with_role(self, *, username, role_name):
        user = get_user_model().objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="testpass123",
        )
        role, _ = Role.objects.get_or_create(name=role_name)
        user.roles.add(role)
        return user

    def _create_issue(
        self,
        *,
        title="Volume 1, Issue 1",
        volume="1",
        number="1",
        issue_status=Issue.Status.DRAFT,
        is_current=False,
    ):
        return Issue.objects.create(
            title=title,
            volume=volume,
            number=number,
            year=self.year,
            status=issue_status,
            is_current=is_current,
            published_at=(
                timezone.now()
                if issue_status == Issue.Status.PUBLISHED
                else None
            ),
        )

    def _create_article(
        self,
        *,
        issue=None,
        article_status=PublishedArticle.Status.DRAFT,
        slug="issue-management-test-article",
    ):
        submission = Submission.objects.create(
            title=f"Submission for {slug}",
            abstract="An accepted manuscript used for issue lifecycle tests.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
        )
        return PublishedArticle.objects.create(
            submission=submission,
            section=self.section,
            publication_issue=issue,
            title=f"Article {slug}",
            slug=slug,
            abstract="A publication record used for issue lifecycle tests.",
            status=article_status,
            published_at=(
                timezone.now()
                if article_status == PublishedArticle.Status.PUBLISHED
                else None
            ),
        )

    def _authenticate_as_eic(self):
        self.client.force_authenticate(self.eic)

    def _open_issue(self, issue):
        return self.client.post(
            reverse("publishing-issue-open", args=[issue.id]),
        )

    def _close_issue(self, issue):
        return self.client.post(
            reverse("publishing-issue-close", args=[issue.id]),
        )

    def test_eic_can_create_draft_issue(self):
        self._authenticate_as_eic()

        response = self.client.post(
            reverse("publishing-issue-list"),
            {
                "title": "Volume 5, Issue 2",
                "volume": "5",
                "number": "2",
                "year": self.year,
                "description": "A continuous-publication issue.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Issue.Status.DRAFT)
        self.assertFalse(response.data["is_current"])
        self.assertIsNone(response.data["published_at"])
        self.assertEqual(response.data["article_count"], 0)
        self.assertEqual(response.data["published_article_count"], 0)
        self.assertEqual(response.data["draft_article_count"], 0)

        issue = Issue.objects.get(pk=response.data["id"])
        self.assertEqual(issue.volume, "5")
        self.assertEqual(issue.number, "2")
        self.assertEqual(issue.year, self.year)
        self.assertTrue(issue.slug)

    def test_unauthenticated_user_cannot_manage_issues(self):
        response = self.client.get(reverse("publishing-issue-list"))

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_non_eic_editorial_and_admin_roles_cannot_manage_issues(self):
        blocked_roles = [
            Role.RoleName.ADMIN,
            Role.RoleName.SECTION_MANAGER,
            Role.RoleName.SECTION_EDITOR,
            Role.RoleName.REVIEWER,
            Role.RoleName.AUTHOR,
        ]

        for index, role_name in enumerate(blocked_roles, start=1):
            with self.subTest(role_name=role_name):
                user = self._create_user_with_role(
                    username=f"blocked-issue-user-{index}",
                    role_name=role_name,
                )
                self.client.force_authenticate(user)

                response = self.client.get(
                    reverse("publishing-issue-list"),
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

    def test_superuser_can_manage_issues(self):
        superuser = get_user_model().objects.create_superuser(
            username="issue-superuser",
            email="issue-superuser@example.com",
            password="testpass123",
        )
        self.client.force_authenticate(superuser)

        response = self.client.post(
            reverse("publishing-issue-list"),
            {
                "title": "Superuser-created issue",
                "volume": "9",
                "number": "1",
                "year": self.year,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_workflow_fields_cannot_be_written_directly(self):
        issue = self._create_issue()
        self._authenticate_as_eic()

        response = self.client.patch(
            reverse("publishing-issue-detail", args=[issue.id]),
            {
                "status": Issue.Status.PUBLISHED,
                "is_current": True,
                "published_at": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("status", response.data)
        self.assertIn("is_current", response.data)
        self.assertIn("published_at", response.data)

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.DRAFT)
        self.assertFalse(issue.is_current)
        self.assertIsNone(issue.published_at)

    def test_eic_can_edit_draft_issue_metadata(self):
        issue = self._create_issue()
        self._authenticate_as_eic()

        response = self.client.patch(
            reverse("publishing-issue-detail", args=[issue.id]),
            {
                "title": "Updated issue title",
                "description": "Updated before the issue was opened.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        issue.refresh_from_db()
        self.assertEqual(issue.title, "Updated issue title")
        self.assertEqual(
            issue.description,
            "Updated before the issue was opened.",
        )

    def test_eic_can_open_and_close_issue(self):
        issue = self._create_issue()
        self._authenticate_as_eic()

        open_response = self._open_issue(issue)

        self.assertEqual(open_response.status_code, status.HTTP_200_OK)

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.PUBLISHED)
        self.assertTrue(issue.is_current)
        self.assertIsNotNone(issue.published_at)

        close_response = self._close_issue(issue)

        self.assertEqual(close_response.status_code, status.HTTP_200_OK)

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.ARCHIVED)
        self.assertFalse(issue.is_current)
        self.assertIsNotNone(issue.published_at)

    def test_second_issue_cannot_open_while_current_issue_exists(self):
        current_issue = self._create_issue(
            title="Current issue",
            number="1",
            issue_status=Issue.Status.PUBLISHED,
            is_current=True,
        )
        draft_issue = self._create_issue(
            title="Successor issue",
            number="2",
        )
        self._authenticate_as_eic()

        response = self._open_issue(draft_issue)

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("Close the current issue", str(response.data))

        current_issue.refresh_from_db()
        draft_issue.refresh_from_db()
        self.assertTrue(current_issue.is_current)
        self.assertEqual(current_issue.status, Issue.Status.PUBLISHED)
        self.assertFalse(draft_issue.is_current)
        self.assertEqual(draft_issue.status, Issue.Status.DRAFT)

    def test_issue_with_incomplete_metadata_cannot_be_opened(self):
        issue = self._create_issue(
            title=" ",
            volume="",
            number="",
        )
        self._authenticate_as_eic()

        response = self._open_issue(issue)

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("title", response.data)
        self.assertIn("volume", response.data)
        self.assertIn("number", response.data)

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.DRAFT)
        self.assertFalse(issue.is_current)
        self.assertIsNone(issue.published_at)

    def test_open_issue_metadata_cannot_be_edited(self):
        issue = self._create_issue()
        original_title = issue.title
        self._authenticate_as_eic()
        self.assertEqual(
            self._open_issue(issue).status_code,
            status.HTTP_200_OK,
        )

        response = self.client.patch(
            reverse("publishing-issue-detail", args=[issue.id]),
            {"title": "Changed after opening"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("Only draft issues", str(response.data))

        issue.refresh_from_db()
        self.assertEqual(issue.title, original_title)

    def test_only_current_open_issue_can_be_closed(self):
        draft_issue = self._create_issue()
        self._authenticate_as_eic()

        draft_response = self._close_issue(draft_issue)

        self.assertEqual(
            draft_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

        archived_issue = self._create_issue(
            title="Previously archived issue",
            volume="2",
            number="1",
            issue_status=Issue.Status.ARCHIVED,
        )

        archived_response = self._close_issue(archived_issue)

        self.assertEqual(
            archived_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_issue_with_publication_drafts_cannot_close(self):
        issue = self._create_issue(
            issue_status=Issue.Status.PUBLISHED,
            is_current=True,
        )
        self._create_article(issue=issue)
        self._authenticate_as_eic()

        response = self._close_issue(issue)

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("publication drafts", str(response.data))

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.PUBLISHED)
        self.assertTrue(issue.is_current)

    def test_published_articles_do_not_prevent_issue_closure(self):
        issue = self._create_issue(
            issue_status=Issue.Status.PUBLISHED,
            is_current=True,
        )
        self._create_article(
            issue=issue,
            article_status=PublishedArticle.Status.PUBLISHED,
        )
        self._authenticate_as_eic()

        response = self._close_issue(issue)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.Status.ARCHIVED)
        self.assertFalse(issue.is_current)

    def test_archived_issue_remains_public(self):
        issue = self._create_issue()
        self._authenticate_as_eic()
        self.assertEqual(
            self._open_issue(issue).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self._close_issue(issue).status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(user=None)
        list_response = self.client.get(reverse("public-issue-list"))
        detail_response = self.client.get(
            reverse("public-issue-detail", args=[issue.slug]),
        )

        self.assertEqual(
            list_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            detail_response.status_code,
            status.HTTP_200_OK,
        )
        self.assertIn(
            issue.slug,
            [item["slug"] for item in list_response.data],
        )
        self.assertEqual(detail_response.data["slug"], issue.slug)

    def test_current_endpoint_returns_404_after_issue_closes(self):
        issue = self._create_issue()
        self._authenticate_as_eic()
        self.assertEqual(
            self._open_issue(issue).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self._close_issue(issue).status_code,
            status.HTTP_200_OK,
        )

        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("public-current-issue"))

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_article_cannot_be_assigned_to_draft_or_archived_issue(self):
        article = self._create_article(
            article_status=PublishedArticle.Status.DRAFT,
        )
        self.assertEqual(
            article.status,
            PublishedArticle.Status.DRAFT,
        )
        draft_issue = self._create_issue(
            title="Future draft issue",
            number="2",
        )
        archived_issue = self._create_issue(
            title="Closed issue",
            number="3",
            issue_status=Issue.Status.ARCHIVED,
        )
        self._authenticate_as_eic()
        url = reverse(
            "publishing-article-detail",
            args=[article.id],
        )

        for issue in [draft_issue, archived_issue]:
            with self.subTest(issue_status=issue.status):
                response = self.client.patch(
                    url,
                    {"publication_issue": str(issue.id)},
                    format="json",
                )

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("current open issue", str(response.data))

        article.refresh_from_db()
        self.assertIsNone(article.publication_issue_id)

    def test_article_can_be_assigned_to_current_open_issue(self):
        article = self._create_article(
            article_status=PublishedArticle.Status.DRAFT,
        )
        self.assertEqual(
            article.status,
            PublishedArticle.Status.DRAFT,
        )
        current_issue = self._create_issue(
            issue_status=Issue.Status.PUBLISHED,
            is_current=True,
        )
        self._authenticate_as_eic()

        response = self.client.patch(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            ),
            {"publication_issue": str(current_issue.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        article.refresh_from_db()
        self.assertEqual(article.publication_issue, current_issue)
        self.assertEqual(article.volume, current_issue.volume)
        self.assertEqual(article.issue, current_issue.number)

    def test_management_list_reports_counts_and_supports_status_filter(self):
        current_issue = self._create_issue(
            title="Current issue",
            number="1",
            issue_status=Issue.Status.PUBLISHED,
            is_current=True,
        )
        self._create_article(
            issue=current_issue,
            article_status=PublishedArticle.Status.PUBLISHED,
            slug="published-counted-article",
        )
        self._create_article(
            issue=current_issue,
            slug="draft-counted-article",
        )
        draft_issue = self._create_issue(
            title="Upcoming issue",
            number="2",
        )
        self._authenticate_as_eic()

        response = self.client.get(
            reverse("publishing-issue-list"),
            {"status": Issue.Status.PUBLISHED},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], str(current_issue.id))
        self.assertEqual(response.data[0]["article_count"], 2)
        self.assertEqual(response.data[0]["published_article_count"], 1)
        self.assertEqual(response.data[0]["draft_article_count"], 1)
        self.assertNotEqual(response.data[0]["id"], str(draft_issue.id))

    def test_invalid_status_filter_returns_400(self):
        self._authenticate_as_eic()

        response = self.client.get(
            reverse("publishing-issue-list"),
            {"status": "not-a-real-status"},
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("status", response.data)