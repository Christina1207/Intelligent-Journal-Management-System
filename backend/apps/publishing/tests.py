from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.journals.models import Section
from apps.submissions.models import Submission, SubmissionTopic, SubmissionVersion

from .models import PublishedArticle
from .services import PublishingService


class PublishingServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="author",
            email="author@example.com",
            password="testpass123",
        )
        self.section = Section.objects.create(name="Computer Science")

    def _create_submission(
        self,
        *,
        status=Submission.Status.ACCEPTED,
        version_decision=SubmissionVersion.Decision.ACCEPTED,
        title="Semantic Matching in Editorial Workflows",
    ):
        submission = Submission.objects.create(
            title=title,
            abstract="A study about intelligent publishing workflow support.",
            language="en",
            author=self.user,
            section=self.section,
            status=status,
        )
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=1,
            file="submissions/example/v1/manuscript.pdf",
            decision=version_decision,
        )
        return submission

    def test_cannot_create_draft_from_non_accepted_submission(self):
        submission = self._create_submission(
            status=Submission.Status.REVIEWED,
            version_decision=SubmissionVersion.Decision.PENDING,
        )

        with self.assertRaises(ValidationError):
            PublishingService.create_draft_from_submission(submission)

    def test_create_draft_from_accepted_submission_copies_public_metadata(self):
        submission = self._create_submission()
        SubmissionTopic.objects.create(
            submission=submission,
            label="Editorial AI",
            keywords=["publishing", "semantic matching"],
        )

        article = PublishingService.create_draft_from_submission(submission)

        self.assertEqual(article.status, PublishedArticle.Status.DRAFT)
        self.assertEqual(article.submission, submission)
        self.assertEqual(article.section, submission.section)
        self.assertEqual(article.title, submission.title)
        self.assertEqual(article.abstract, submission.abstract)
        self.assertEqual(article.keywords, ["publishing", "semantic matching"])
        self.assertEqual(article.pdf_file.name, "submissions/example/v1/manuscript.pdf")
        self.assertTrue(article.slug.startswith("semantic-matching-in-editorial-workflows"))

    def test_cannot_create_duplicate_draft_for_submission(self):
        submission = self._create_submission()
        PublishingService.create_draft_from_submission(submission)

        with self.assertRaises(ValidationError):
            PublishingService.create_draft_from_submission(submission)

    def test_publish_article_sets_published_status_and_timestamp(self):
        submission = self._create_submission()
        article = PublishingService.create_draft_from_submission(submission)

        article = PublishingService.publish_article(article)

        self.assertEqual(article.status, PublishedArticle.Status.PUBLISHED)
        self.assertIsNotNone(article.published_at)


class PublishingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="editor",
            email="editor@example.com",
            password="testpass123",
        )
        self.author = get_user_model().objects.create_user(
            username="author",
            email="api-author@example.com",
            password="testpass123",
        )
        self.section = Section.objects.create(name="Artificial Intelligence")
        self.submission = Submission.objects.create(
            title="Reviewer Recommendation for Journals",
            abstract="An accepted manuscript about reviewer recommendation.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
        )
        SubmissionVersion.objects.create(
            submission=self.submission,
            version_number=1,
            file="submissions/api/v1/manuscript.pdf",
            decision=SubmissionVersion.Decision.ACCEPTED,
        )

    def _create_article(self, *, status, slug, published_at=None):
        return PublishedArticle.objects.create(
            submission=self.submission,
            section=self.section,
            title=f"Article {slug}",
            slug=slug,
            abstract="Public abstract.",
            status=status,
            published_at=published_at,
        )

    def test_create_draft_endpoint_requires_authentication(self):
        response = self.client.post(
            f"/api/v1/publishing/submissions/{self.submission.id}/create-draft/",
        )

        self.assertIn(response.status_code, [401, 403])

    def test_create_draft_endpoint_returns_created_article(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            f"/api/v1/publishing/submissions/{self.submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], PublishedArticle.Status.DRAFT)
        self.assertEqual(response.data["submission_id"], str(self.submission.id))

    def test_public_list_excludes_draft_and_retracted_articles(self):
        published = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="published-article",
            published_at=timezone.now(),
        )
        other_submission = Submission.objects.create(
            title="Retracted Source",
            abstract="Another accepted manuscript.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
        )
        PublishedArticle.objects.create(
            submission=other_submission,
            section=self.section,
            title="Retracted Article",
            slug="retracted-article",
            abstract="Retracted abstract.",
            status=PublishedArticle.Status.RETRACTED,
            published_at=timezone.now(),
        )
        draft_submission = Submission.objects.create(
            title="Draft Source",
            abstract="A manuscript still being prepared for publication.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
        )
        PublishedArticle.objects.create(
            submission=draft_submission,
            section=self.section,
            title="Draft Article",
            slug="draft-article",
            abstract="Draft abstract.",
            status=PublishedArticle.Status.DRAFT,
        )

        response = self.client.get("/api/v1/public/articles/")

        self.assertEqual(response.status_code, 200)
        slugs = [item["slug"] for item in response.data["results"]]
        self.assertEqual(slugs, [published.slug])

    def test_public_detail_uses_slug_and_increments_view_count(self):
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="public-detail",
            published_at=timezone.now(),
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["slug"], article.slug)
        article.refresh_from_db()
        self.assertEqual(article.view_count, 1)

    def test_publish_endpoint_publishes_draft_article(self):
        self.client.force_authenticate(self.user)
        article = PublishingService.create_draft_from_submission(self.submission)

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], PublishedArticle.Status.PUBLISHED)
        self.assertIsNotNone(response.data["published_at"])
