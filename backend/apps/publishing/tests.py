from unittest.mock import patch

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
        version_file="submissions/example/v1/manuscript.pdf",
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
            file=version_file,
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

    def test_cannot_create_draft_without_accepted_version_file(self):
        submission = self._create_submission(version_file="")

        with self.assertRaisesMessage(ValidationError, "manuscript file"):
            PublishingService.create_draft_from_submission(submission)

    def test_create_draft_supports_long_minio_object_path(self):
        long_object_path = (
            "submissions/"
            + "a" * 120
            + "/v1/manuscript-with-a-long-generated-storage-name.pdf"
        )
        submission = self._create_submission(version_file=long_object_path)

        article = PublishingService.create_draft_from_submission(submission)

        self.assertEqual(article.pdf_file.name, long_object_path)

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

    def _create_submission(
        self,
        *,
        section=None,
        status=Submission.Status.ACCEPTED,
        title="Accepted API Submission",
        abstract="An accepted manuscript.",
        version_file="submissions/api/v1/manuscript.pdf",
        version_decision=SubmissionVersion.Decision.ACCEPTED,
        create_version=True,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract=abstract,
            language="en",
            author=self.author,
            section=section or self.section,
            status=status,
        )
        if create_version:
            SubmissionVersion.objects.create(
                submission=submission,
                version_number=1,
                file=version_file,
                decision=version_decision,
            )
        return submission

    def _create_article(
        self,
        *,
        status,
        slug,
        section=None,
        submission=None,
        title=None,
        abstract="Public abstract.",
        published_at=None,
        pdf_file="submissions/api/v1/manuscript.pdf",
        view_count=0,
        download_count=0,
    ):
        section = section or self.section
        submission = submission or self._create_submission(
            section=section,
            title=title or f"Submission for {slug}",
            abstract=abstract,
            version_file=pdf_file,
        )
        if published_at is None and status == PublishedArticle.Status.PUBLISHED:
            published_at = timezone.now()

        return PublishedArticle.objects.create(
            submission=submission,
            section=section,
            title=title or f"Article {slug}",
            slug=slug,
            abstract=abstract,
            pdf_file=pdf_file,
            status=status,
            published_at=published_at,
            view_count=view_count,
            download_count=download_count,
        )

    def _response_slugs(self, response):
        data = response.data["results"] if "results" in response.data else response.data
        return [item["slug"] for item in data]

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

    def test_duplicate_create_draft_endpoint_returns_clean_400(self):
        self.client.force_authenticate(self.user)
        url = f"/api/v1/publishing/submissions/{self.submission.id}/create-draft/"
        self.client.post(url)

        response = self.client.post(url)

        self.assertEqual(response.status_code, 400)
        self.assertIn("already has a published article or publication draft", str(response.data))

    def test_non_accepted_submission_create_draft_returns_clean_400(self):
        self.client.force_authenticate(self.user)
        submission = self._create_submission(
            status=Submission.Status.REVIEWED,
            version_decision=SubmissionVersion.Decision.PENDING,
        )

        response = self.client.post(
            f"/api/v1/publishing/submissions/{submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Only accepted submissions can be moved", str(response.data))

    def test_create_draft_without_publishable_file_returns_clean_400(self):
        self.client.force_authenticate(self.user)
        submission = self._create_submission(version_file="")

        response = self.client.post(
            f"/api/v1/publishing/submissions/{submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("manuscript file", str(response.data))

    def test_create_draft_without_accepted_version_returns_clean_400(self):
        self.client.force_authenticate(self.user)
        submission = self._create_submission(create_version=False)

        response = self.client.post(
            f"/api/v1/publishing/submissions/{submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("no accepted submission version", str(response.data))

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
        self.assertEqual(self._response_slugs(response), [published.slug])

    def test_public_list_filters_by_section(self):
        other_section = Section.objects.create(name="Medical Informatics")
        matching = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="ai-section-article",
            section=self.section,
        )
        self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="medical-section-article",
            section=other_section,
        )

        response = self.client.get(
            f"/api/v1/public/articles/?section={self.section.id}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._response_slugs(response), [matching.slug])

    def test_public_section_article_list_returns_only_published_articles(self):
        other_section = Section.objects.create(name="Data Science")
        published = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="published-in-section",
            section=self.section,
        )
        self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="published-in-other-section",
            section=other_section,
        )
        self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="draft-in-section",
            section=self.section,
        )

        response = self.client.get(
            f"/api/v1/public/sections/{self.section.id}/articles/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._response_slugs(response), [published.slug])

    def test_public_list_searches_title_and_abstract(self):
        title_match = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="plagiarism-title",
            title="Plagiarism Screening for Journal Submissions",
        )
        abstract_match = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="semantic-abstract",
            title="Editorial Decision Support",
            abstract="This article studies semantic reviewer recommendation.",
        )
        self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="unrelated-public",
            title="Issue Archive Management",
            abstract="A public article about publishing archives.",
        )

        title_response = self.client.get("/api/v1/public/articles/?search=plagiarism")
        abstract_response = self.client.get(
            "/api/v1/public/articles/?search=reviewer%20recommendation"
        )

        self.assertEqual(title_response.status_code, 200)
        self.assertEqual(abstract_response.status_code, 200)
        self.assertEqual(self._response_slugs(title_response), [title_match.slug])
        self.assertEqual(self._response_slugs(abstract_response), [abstract_match.slug])

    def test_public_list_search_and_filter_never_expose_drafts_or_retracted(self):
        public = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="public-plagiarism",
            title="Plagiarism Evidence Review",
            section=self.section,
        )
        self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="draft-plagiarism",
            title="Plagiarism Draft",
            section=self.section,
        )
        self._create_article(
            status=PublishedArticle.Status.RETRACTED,
            slug="retracted-plagiarism",
            title="Plagiarism Retracted",
            section=self.section,
        )

        response = self.client.get(
            f"/api/v1/public/articles/?section={self.section.id}&search=plagiarism"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._response_slugs(response), [public.slug])

    def test_public_list_valid_ordering_uses_whitelist(self):
        low = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="low-downloads",
            download_count=1,
        )
        high = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="high-downloads",
            download_count=10,
        )
        middle = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="middle-downloads",
            download_count=5,
        )

        response = self.client.get("/api/v1/public/articles/?ordering=-download_count")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._response_slugs(response),
            [high.slug, middle.slug, low.slug],
        )

    def test_public_list_invalid_ordering_returns_clean_400(self):
        response = self.client.get("/api/v1/public/articles/?ordering=status")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported ordering", str(response.data))

    def test_public_list_invalid_section_filter_returns_clean_400(self):
        response = self.client.get("/api/v1/public/articles/?section=not-a-uuid")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid section id", str(response.data))

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

    def test_public_detail_does_not_expose_draft_or_retracted_articles(self):
        draft = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="draft-detail",
        )
        retracted = self._create_article(
            status=PublishedArticle.Status.RETRACTED,
            slug="retracted-detail",
        )

        draft_response = self.client.get(f"/api/v1/public/articles/{draft.slug}/")
        retracted_response = self.client.get(
            f"/api/v1/public/articles/{retracted.slug}/"
        )

        self.assertEqual(draft_response.status_code, 404)
        self.assertEqual(retracted_response.status_code, 404)

    @patch("apps.publishing.services.StorageService")
    def test_public_download_for_published_article_returns_url_and_increments_count(
        self,
        storage_class,
    ):
        storage = storage_class.return_value
        storage.get_public_url.return_value = (
            "http://localhost:9000/journal-submissions/manuscript.pdf"
        )
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="downloadable-article",
            pdf_file="submissions/downloadable/v1/manuscript.pdf",
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/download/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "download_url": (
                    "http://localhost:9000/journal-submissions/manuscript.pdf"
                ),
                "expires_in": 3600,
            },
        )
        storage.get_public_url.assert_called_once_with(
            "submissions/downloadable/v1/manuscript.pdf",
            expires_in_seconds=3600,
        )
        article.refresh_from_db()
        self.assertEqual(article.download_count, 1)

    @patch("apps.publishing.services.StorageService")
    def test_public_download_does_not_expose_draft_article(self, storage_class):
        article = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="draft-download",
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/download/")

        self.assertEqual(response.status_code, 404)
        storage_class.assert_not_called()
        article.refresh_from_db()
        self.assertEqual(article.download_count, 0)

    @patch("apps.publishing.services.StorageService")
    def test_public_download_does_not_expose_retracted_article(self, storage_class):
        article = self._create_article(
            status=PublishedArticle.Status.RETRACTED,
            slug="retracted-download",
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/download/")

        self.assertEqual(response.status_code, 404)
        storage_class.assert_not_called()
        article.refresh_from_db()
        self.assertEqual(article.download_count, 0)

    @patch("apps.publishing.services.StorageService")
    def test_public_download_missing_pdf_returns_clean_404(self, storage_class):
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="missing-pdf-download",
            pdf_file="",
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/download/")

        self.assertEqual(response.status_code, 404)
        storage_class.assert_not_called()
        article.refresh_from_db()
        self.assertEqual(article.download_count, 0)

    @patch("apps.publishing.services.StorageService")
    def test_public_download_storage_failure_returns_clean_503(self, storage_class):
        storage = storage_class.return_value
        storage.get_public_url.side_effect = RuntimeError("MinIO unavailable")
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="download-storage-failure",
            pdf_file="submissions/downloadable/v1/manuscript.pdf",
        )

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/download/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data,
            {"detail": "Article download is temporarily unavailable."},
        )
        article.refresh_from_db()
        self.assertEqual(article.download_count, 0)

    def test_publish_endpoint_publishes_draft_article(self):
        self.client.force_authenticate(self.user)
        article = PublishingService.create_draft_from_submission(self.submission)

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], PublishedArticle.Status.PUBLISHED)
        self.assertIsNotNone(response.data["published_at"])

    def test_patch_cannot_change_article_status_directly(self):
        self.client.force_authenticate(self.user)
        article = PublishingService.create_draft_from_submission(self.submission)

        response = self.client.patch(
            f"/api/v1/publishing/articles/{article.id}/",
            {"status": PublishedArticle.Status.PUBLISHED},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        article.refresh_from_db()
        self.assertEqual(article.status, PublishedArticle.Status.DRAFT)
        self.assertEqual(response.data["status"], PublishedArticle.Status.DRAFT)

    def test_publish_endpoint_rejects_already_published_article(self):
        self.client.force_authenticate(self.user)
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="already-published",
        )

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("already published", str(response.data))

    def test_publish_endpoint_rejects_retracted_article(self):
        self.client.force_authenticate(self.user)
        article = self._create_article(
            status=PublishedArticle.Status.RETRACTED,
            slug="retracted-management",
        )

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Retracted articles cannot be published", str(response.data))
