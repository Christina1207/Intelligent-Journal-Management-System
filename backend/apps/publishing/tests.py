from dataclasses import replace
from datetime import date
from unittest.mock import patch
import xml.etree.ElementTree as ET

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import Http404
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.journals.models import Issue, JournalMetadataSettings, Section
from apps.submissions.models import (
    Submission,
    SubmissionCoAuthor,
    SubmissionTopic,
    SubmissionVersion,
)

from .models import PublishedArticle, PublishedArticleAuthor
from .exporters import (
    DC_NAMESPACE,
    OAI_DC_NAMESPACE,
    render_bibtex,
    render_dublin_core_xml,
    render_ris,
)
from .metadata import (
    ArticleAuthorMetadata,
    ArticleMetadata,
    ArticleMetadataBuilder,
)
from .services import PublishingService


def create_current_published_issue(
    *,
    title="Current Issue",
    volume="1",
    number="1",
):
    return Issue.objects.create(
        title=title,
        volume=volume,
        number=number,
        year=timezone.now().year,
        status=Issue.Status.PUBLISHED,
        published_at=timezone.now(),
        is_current=True,
    )


class PublishingServiceTests(TestCase):
    def setUp(self):
        self.author = get_user_model().objects.create_user(
            username="author",
            email="author@example.com",
            password="testpass123",
            first_name="Ada",
            last_name="Lovelace",
            orcid="0000-0000-0000-0001",
            affiliation="Analytical Engine Institute",
            country="United Kingdom",
        )
        self.editor = get_user_model().objects.create_user(
            username="section-editor",
            email="section-editor@example.com",
            password="testpass123",
        )
        self.section_editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR
        )
        self.editor.roles.add(self.section_editor_role)
        self.section = Section.objects.create(name="Computer Science")
        self.journal_settings = JournalMetadataSettings.objects.create(
            journal_title="Test Journal",
            publisher_name="Test Publisher",
            default_language="en",
            default_license_name="CC BY 4.0",
            default_license_url="https://creativecommons.org/licenses/by/4.0/",
        )

    def _create_submission(
        self,
        *,
        status=Submission.Status.ACCEPTED,
        version_decision=SubmissionVersion.Decision.ACCEPTED,
        version_file="submissions/example/v1/manuscript.pdf",
        title="Semantic Matching in Editorial Workflows",
        assigned_editor=None,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract="A study about intelligent publishing workflow support.",
            language="en",
            author=self.author,
            section=self.section,
            status=status,
            assigned_editor=assigned_editor or self.editor,
        )
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=1,
            file=version_file,
            decision=version_decision,
        )
        return submission

    def test_cannot_create_draft_from_non_accepted_submission(self):
        blocked_states = [
            (Submission.Status.REJECTED, SubmissionVersion.Decision.REJECTED),
            (Submission.Status.UNDER_REVIEW, SubmissionVersion.Decision.PENDING),
            (Submission.Status.UNDER_REVISION, SubmissionVersion.Decision.MAJOR_REVISION),
            (Submission.Status.REVIEWED, SubmissionVersion.Decision.PENDING),
        ]

        for submission_status, version_decision in blocked_states:
            with self.subTest(submission_status=submission_status):
                submission = self._create_submission(
                    status=submission_status,
                    version_decision=version_decision,
                    title=f"Blocked {submission_status}",
                )

                with self.assertRaisesMessage(
                    ValidationError,
                    "Only accepted submissions can be moved to publishing",
                ):
                    PublishingService.create_draft_from_submission(
                        actor=self.editor,
                        submission=submission,
                    )

    def test_create_draft_from_accepted_submission_copies_public_metadata(self):
        submission = self._create_submission()
        latest_version = submission.versions.get(version_number=1)
        SubmissionTopic.objects.create(
            submission=submission,
            label="Editorial AI",
            keywords=["publishing", "semantic matching"],
        )

        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        self.assertEqual(article.status, PublishedArticle.Status.DRAFT)
        self.assertEqual(article.submission, submission)
        self.assertEqual(article.source_version, latest_version)
        self.assertEqual(article.section, submission.section)
        self.assertEqual(article.title, submission.title)
        self.assertEqual(article.abstract, submission.abstract)
        self.assertEqual(article.language, submission.language)
        self.assertEqual(article.keywords, ["publishing", "semantic matching"])
        self.assertEqual(article.license_name, "CC BY 4.0")
        self.assertEqual(
            article.license_url,
            "https://creativecommons.org/licenses/by/4.0/",
        )
        self.assertIsInstance(article.pdf_file, str)
        self.assertEqual(
            article.pdf_file,
            "submissions/example/v1/manuscript.pdf",
        )
        self.assertTrue(article.slug.startswith("semantic-matching-in-editorial-workflows"))

    def test_create_draft_snapshots_primary_author_metadata(self):
        submission = self._create_submission()

        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        author_snapshot = article.authors.get()
        self.assertEqual(author_snapshot.order, 1)
        self.assertEqual(author_snapshot.full_name, "Ada Lovelace")
        self.assertEqual(author_snapshot.email, "author@example.com")
        self.assertEqual(author_snapshot.orcid, "0000-0000-0000-0001")
        self.assertEqual(author_snapshot.affiliation, "Analytical Engine Institute")
        self.assertEqual(author_snapshot.country, "United Kingdom")
        self.assertTrue(author_snapshot.is_corresponding)

    def test_create_draft_snapshots_author_keywords_and_ordered_coauthors(
        self,
    ):
        submission = self._create_submission()
        submission.keywords = [
            "peer review",
            "editorial workflow",
            "machine learning",
        ]
        submission.save(update_fields=["keywords"])

        SubmissionTopic.objects.create(
            submission=submission,
            label="Generated editorial topic",
            keywords=["generated keyword"],
        )

        second_author = SubmissionCoAuthor.objects.create(
            submission=submission,
            full_name="Alan Turing",
            email="alan@example.org",
            orcid="0000-0002-1825-0097",
            affiliation="Computing Laboratory",
            country="United Kingdom",
            order=2,
        )
        SubmissionCoAuthor.objects.create(
            submission=submission,
            full_name="Grace Hopper",
            email="grace@example.org",
            orcid="0000-0002-1694-233X",
            affiliation="Naval Computing Research",
            country="United States",
            order=3,
        )

        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        # Author-supplied keywords take precedence over generated keywords.
        self.assertEqual(
            article.keywords,
            [
                "peer review",
                "editorial workflow",
                "machine learning",
            ],
        )

        author_snapshots = list(
            article.authors.order_by("order").values(
                "full_name",
                "email",
                "orcid",
                "affiliation",
                "country",
                "order",
                "is_corresponding",
            )
        )

        self.assertEqual(
            author_snapshots,
            [
                {
                    "full_name": "Ada Lovelace",
                    "email": "author@example.com",
                    "orcid": "0000-0000-0000-0001",
                    "affiliation": "Analytical Engine Institute",
                    "country": "United Kingdom",
                    "order": 1,
                    "is_corresponding": True,
                },
                {
                    "full_name": "Alan Turing",
                    "email": "alan@example.org",
                    "orcid": "0000-0002-1825-0097",
                    "affiliation": "Computing Laboratory",
                    "country": "United Kingdom",
                    "order": 2,
                    "is_corresponding": False,
                },
                {
                    "full_name": "Grace Hopper",
                    "email": "grace@example.org",
                    "orcid": "0000-0002-1694-233X",
                    "affiliation": "Naval Computing Research",
                    "country": "United States",
                    "order": 3,
                    "is_corresponding": False,
                },
            ],
        )

        # Publication metadata must remain stable if the submission changes later.
        submission.keywords = ["changed after publication"]
        submission.save(update_fields=["keywords"])

        second_author.full_name = "Changed Source Name"
        second_author.save(update_fields=["full_name"])

        article.refresh_from_db()

        self.assertEqual(
            article.keywords,
            [
                "peer review",
                "editorial workflow",
                "machine learning",
            ],
        )
        self.assertEqual(
            list(
                article.authors.order_by("order").values_list(
                    "full_name",
                    flat=True,
                )
            ),
            [
                "Ada Lovelace",
                "Alan Turing",
                "Grace Hopper",
            ],
        )

    def test_source_changes_after_draft_creation_do_not_change_snapshot(self):
        submission = self._create_submission()

        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )
        author_snapshot = article.authors.get()

        submission.title = "Changed Submission Title"
        submission.abstract = "Changed submission abstract."
        submission.language = "ar"
        submission.save(update_fields=["title", "abstract", "language"])
        self.author.first_name = "Changed"
        self.author.last_name = "Author"
        self.author.email = "changed-author@example.com"
        self.author.orcid = "0000-0000-0000-9999"
        self.author.affiliation = "Changed Affiliation"
        self.author.country = "Changed Country"
        self.author.save(
            update_fields=[
                "first_name",
                "last_name",
                "email",
                "orcid",
                "affiliation",
                "country",
            ]
        )

        article.refresh_from_db()
        author_snapshot.refresh_from_db()

        self.assertEqual(article.title, "Semantic Matching in Editorial Workflows")
        self.assertEqual(
            article.abstract,
            "A study about intelligent publishing workflow support.",
        )
        self.assertEqual(article.language, "en")
        self.assertEqual(author_snapshot.full_name, "Ada Lovelace")
        self.assertEqual(author_snapshot.email, "author@example.com")
        self.assertEqual(author_snapshot.orcid, "0000-0000-0000-0001")
        self.assertEqual(author_snapshot.affiliation, "Analytical Engine Institute")
        self.assertEqual(author_snapshot.country, "United Kingdom")

    def test_duplicate_published_author_order_is_rejected_for_same_article(self):
        submission = self._create_submission()
        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PublishedArticleAuthor.objects.create(
                    article=article,
                    order=1,
                    full_name="Duplicate Author",
                )

    def test_non_section_editor_cannot_create_draft(self):
        non_editor = get_user_model().objects.create_user(
            username="not-an-editor",
            email="not-an-editor@example.com",
            password="testpass123",
        )
        submission = self._create_submission(assigned_editor=non_editor)

        with self.assertRaisesMessage(
            PermissionDenied,
            "You cannot create a publishing draft for this submission.",
        ):
            PublishingService.create_draft_from_submission(
                actor=non_editor,
                submission=submission,
            )

    def test_unassigned_section_editor_cannot_create_draft(self):
        other_editor = get_user_model().objects.create_user(
            username="other-section-editor",
            email="other-section-editor@example.com",
            password="testpass123",
        )
        other_editor.roles.add(self.section_editor_role)
        submission = self._create_submission()

        with self.assertRaisesMessage(
            PermissionDenied,
            "You cannot create a publishing draft for this submission.",
        ):
            PublishingService.create_draft_from_submission(
                actor=other_editor,
                submission=submission,
            )

    def test_section_editor_assigned_to_another_submission_cannot_create_draft(self):
        other_editor = get_user_model().objects.create_user(
            username="assigned-elsewhere",
            email="assigned-elsewhere@example.com",
            password="testpass123",
        )
        other_editor.roles.add(self.section_editor_role)
        self._create_submission(
            title="Submission assigned to another section editor",
            assigned_editor=other_editor,
        )
        submission = self._create_submission(title="Original assigned submission")

        with self.assertRaisesMessage(
            PermissionDenied,
            "You cannot create a publishing draft for this submission.",
        ):
            PublishingService.create_draft_from_submission(
                actor=other_editor,
                submission=submission,
            )

    def test_latest_pending_version_blocks_even_if_older_version_was_accepted(self):
        submission = self._create_submission()
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=2,
            file="submissions/example/v2/manuscript.pdf",
            decision=SubmissionVersion.Decision.PENDING,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only the latest accepted version can be moved to publishing.",
        ):
            PublishingService.create_draft_from_submission(
                actor=self.editor,
                submission=submission,
            )

        self.assertFalse(PublishedArticle.objects.filter(submission=submission).exists())

    def test_latest_rejected_version_blocks_even_if_older_version_was_accepted(self):
        submission = self._create_submission()
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=2,
            file="submissions/example/v2/manuscript.pdf",
            decision=SubmissionVersion.Decision.REJECTED,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "Only the latest accepted version can be moved to publishing.",
        ):
            PublishingService.create_draft_from_submission(
                actor=self.editor,
                submission=submission,
            )

        self.assertFalse(PublishedArticle.objects.filter(submission=submission).exists())

    def test_cannot_create_duplicate_draft_for_submission(self):
        submission = self._create_submission()
        PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        with self.assertRaises(ValidationError):
            PublishingService.create_draft_from_submission(
                actor=self.editor,
                submission=submission,
            )

    def test_cannot_create_draft_without_accepted_version_file(self):
        submission = self._create_submission(version_file="")

        with self.assertRaisesMessage(ValidationError, "manuscript file"):
            PublishingService.create_draft_from_submission(
                actor=self.editor,
                submission=submission,
            )

    def test_create_draft_supports_long_minio_object_path(self):
        long_object_path = (
            "submissions/"
            + "a" * 120
            + "/v1/manuscript-with-a-long-generated-storage-name.pdf"
        )
        submission = self._create_submission(version_file=long_object_path)

        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        self.assertEqual(article.pdf_file, long_object_path)

    def test_publish_article_sets_published_status_and_timestamp(self):
        submission = self._create_submission()
        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )
        issue = create_current_published_issue()

        article = PublishingService.publish_article(article)

        article.refresh_from_db()
        self.assertEqual(article.status, PublishedArticle.Status.PUBLISHED)
        self.assertIsNotNone(article.published_at)
        self.assertEqual(article.publication_issue, issue)
        self.assertEqual(article.volume, issue.volume)
        self.assertEqual(article.issue, issue.number)

    def test_publish_article_requires_a_published_issue(self):
        submission = self._create_submission()
        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )

        with self.assertRaisesMessage(
            ValidationError,
            "published issue",
        ):
            PublishingService.publish_article(article)

        article.refresh_from_db()

        self.assertEqual(
            article.status,
            PublishedArticle.Status.DRAFT,
        )
        self.assertIsNone(article.published_at)
        self.assertIsNone(article.publication_issue_id)

    def test_publish_article_honors_explicit_published_issue(self):
        submission = self._create_submission()
        article = PublishingService.create_draft_from_submission(
            actor=self.editor,
            submission=submission,
        )
        issue = Issue.objects.create(
            title="Explicit Publication Issue",
            volume="7",
            number="3",
            year=timezone.now().year,
            status=Issue.Status.PUBLISHED,
            published_at=timezone.now(),
            is_current=False,
        )

        article.publication_issue = issue
        article.volume = "stale-volume"
        article.issue = "stale-issue"
        article.save(
            update_fields=[
                "publication_issue",
                "volume",
                "issue",
            ]
        )

        article = PublishingService.publish_article(article)

        self.assertEqual(
            article.status,
            PublishedArticle.Status.PUBLISHED,
        )
        self.assertEqual(article.publication_issue, issue)
        self.assertEqual(article.volume, issue.volume)
        self.assertEqual(article.issue, issue.number)
        self.assertIsNotNone(article.published_at)

    def test_explicit_invalid_issue_is_not_silently_replaced(self):
        current_issue = create_current_published_issue(
            title="Valid Current Issue",
            volume="10",
            number="1",
        )

        for index, issue_status in enumerate(
            [
                Issue.Status.DRAFT,
                Issue.Status.ARCHIVED,
            ],
            start=1,
        ):
            with self.subTest(issue_status=issue_status):
                submission = self._create_submission(
                    title=(
                        "Invalid issue publication "
                        f"{issue_status}"
                    )
                )
                article = (
                    PublishingService
                    .create_draft_from_submission(
                        actor=self.editor,
                        submission=submission,
                    )
                )
                invalid_issue = Issue.objects.create(
                    title=f"Invalid {issue_status} Issue",
                    volume=str(20 + index),
                    number="1",
                    year=timezone.now().year,
                    status=issue_status,
                    is_current=False,
                )

                article.publication_issue = invalid_issue
                article.save(
                    update_fields=["publication_issue"]
                )

                with self.assertRaisesMessage(
                    ValidationError,
                    "status 'published'",
                ):
                    PublishingService.publish_article(article)

                article.refresh_from_db()

                self.assertEqual(
                    article.status,
                    PublishedArticle.Status.DRAFT,
                )
                self.assertEqual(
                    article.publication_issue,
                    invalid_issue,
                )
                self.assertNotEqual(
                    article.publication_issue,
                    current_issue,
                )
                self.assertIsNone(article.published_at)


class ArticleMetadataBuilderTests(TestCase):
    def setUp(self):
        self.author = get_user_model().objects.create_user(
            username="metadata-author",
            email="metadata-author@example.com",
            password="testpass123",
            first_name="Live",
            last_name="Author",
        )
        self.section = Section.objects.create(name="Metadata Systems")
        JournalMetadataSettings.objects.create(
            journal_title="Intelligent Journal",
            publisher_name="Open Publishing Lab",
            print_issn="1234-5678",
            online_issn="8765-4321",
            base_url="https://journal.example.org",
            default_language="en",
        )

    def _create_article(
        self,
        *,
        slug="metadata-builder-article",
        status=PublishedArticle.Status.PUBLISHED,
        title="Arabic & English Metadata <Study>",
        abstract="A public abstract with reusable metadata.",
        language="ar",
        keywords=None,
        doi="10.1234/ijms.metadata",
        pdf_file="published/articles/metadata.pdf",
        published_at=None,
    ):
        submission = Submission.objects.create(
            title=f"Submission for {slug}",
            abstract="Original submission abstract.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
        )
        if published_at is None and status == PublishedArticle.Status.PUBLISHED:
            published_at = timezone.now()

        return PublishedArticle.objects.create(
            submission=submission,
            section=self.section,
            title=title,
            slug=slug,
            abstract=abstract,
            language=language,
            keywords=keywords if keywords is not None else ["metadata", "exports"],
            doi=doi,
            license_name="CC BY 4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            volume="4",
            issue="2",
            first_page="10",
            last_page="20",
            pdf_file=pdf_file,
            status=status,
            published_at=published_at,
        )

    def test_builds_metadata_from_article_snapshots_and_journal_settings(self):
        article = self._create_article()
        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Snapshot Author",
            email="snapshot@example.com",
            orcid="0000-0000-0000-0002",
            affiliation="Snapshot University",
            country="Syria",
            order=1,
            is_corresponding=True,
        )

        metadata = ArticleMetadataBuilder().build(article)

        self.assertEqual(metadata.title, "Arabic & English Metadata <Study>")
        self.assertEqual(metadata.abstract, "A public abstract with reusable metadata.")
        self.assertEqual(metadata.journal_title, "Intelligent Journal")
        self.assertEqual(metadata.publisher_name, "Open Publishing Lab")
        self.assertEqual(metadata.print_issn, "1234-5678")
        self.assertEqual(metadata.online_issn, "8765-4321")
        self.assertEqual(metadata.section_name, "Metadata Systems")
        self.assertEqual(metadata.year, str(article.published_at.year))
        self.assertEqual(metadata.doi, "10.1234/ijms.metadata")
        self.assertEqual(metadata.language, "ar")
        self.assertEqual(metadata.keywords, ["metadata", "exports"])
        self.assertEqual(metadata.volume, "4")
        self.assertEqual(metadata.issue, "2")
        self.assertEqual(metadata.first_page, "10")
        self.assertEqual(metadata.last_page, "20")
        self.assertEqual(
            metadata.article_url,
            "https://journal.example.org/api/v1/public/articles/"
            "metadata-builder-article/",
        )
        self.assertEqual(
            metadata.pdf_url,
            "https://journal.example.org/api/v1/public/articles/"
            "metadata-builder-article/download/",
        )
        self.assertEqual(len(metadata.authors), 1)
        self.assertEqual(metadata.authors[0].full_name, "Snapshot Author")
        self.assertEqual(metadata.authors[0].email, "snapshot@example.com")

    def test_uses_author_snapshots_not_live_submission_author_data(self):
        article = self._create_article(slug="snapshot-source-check")
        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Stored Snapshot",
            email="stored@example.com",
            order=1,
            is_corresponding=True,
        )
        self.author.first_name = "Changed"
        self.author.last_name = "Live User"
        self.author.email = "changed@example.com"
        self.author.save(update_fields=["first_name", "last_name", "email"])

        metadata = ArticleMetadataBuilder().build(article)

        self.assertEqual([author.full_name for author in metadata.authors], ["Stored Snapshot"])
        self.assertEqual(metadata.authors[0].email, "stored@example.com")

    def test_handles_missing_optional_fields_and_settings_without_mutating_database(self):
        JournalMetadataSettings.objects.all().delete()
        article = self._create_article(
            slug="missing-optional-metadata",
            title="Minimal Published Article",
            abstract="",
            language="",
            keywords=[],
            doi=None,
            pdf_file="",
        )

        metadata = ArticleMetadataBuilder().build(article)

        self.assertEqual(JournalMetadataSettings.objects.count(), 0)
        self.assertEqual(metadata.journal_title, "Untitled Journal")
        self.assertIsNone(metadata.abstract)
        self.assertIsNone(metadata.doi)
        self.assertIsNone(metadata.article_url)
        self.assertIsNone(metadata.pdf_url)
        self.assertEqual(metadata.keywords, [])
        self.assertEqual(metadata.authors, [])

    def test_rejects_unpublished_article_metadata(self):
        article = self._create_article(
            slug="draft-metadata",
            status=PublishedArticle.Status.DRAFT,
            published_at=None,
        )

        with self.assertRaises(Http404):
            ArticleMetadataBuilder().build(article)


class MetadataRendererTests(TestCase):
    def _metadata(self):
        return ArticleMetadata(
            title=r"Example {Title} & 100%_# \ Study",
            abstract="An abstract with <xml> & BibTeX-sensitive characters.",
            authors=[
                ArticleAuthorMetadata(
                    full_name="Smith, John",
                    email="john@example.com",
                    orcid=None,
                    affiliation=None,
                    country=None,
                    order=1,
                    is_corresponding=True,
                ),
                ArticleAuthorMetadata(
                    full_name="Doe, Jane",
                    email=None,
                    orcid=None,
                    affiliation=None,
                    country=None,
                    order=2,
                    is_corresponding=False,
                ),
            ],
            journal_title="Intelligent Journal",
            publisher_name="Open Publishing Lab",
            print_issn="1234-5678",
            online_issn="8765-4321",
            section_name="Metadata Systems",
            publication_date=date(2026, 7, 5),
            year="2026",
            doi="10.1234/example",
            slug="example-article",
            article_url="https://journal.example.org/api/v1/public/articles/example-article/",
            pdf_url="https://journal.example.org/api/v1/public/articles/example-article/download/",
            language="en",
            keywords=["metadata", "journal exports"],
            license_name="CC BY 4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            volume="4",
            issue="2",
            first_page="1",
            last_page="9",
        )

    def test_bibtex_renderer_outputs_article_with_escaped_fields_and_stable_key(self):
        output = render_bibtex(self._metadata())

        self.assertTrue(output.startswith("@article{examplearticle,"))
        self.assertIn(r"title = {Example \{Title\} \& 100\%\_\# \textbackslash{} Study}", output)
        self.assertIn("author = {Smith, John and Doe, Jane}", output)
        self.assertIn("journal = {Intelligent Journal}", output)
        self.assertIn("year = {2026}", output)
        self.assertIn("doi = {10.1234/example}", output)
        self.assertIn(
            "url = {https://journal.example.org/api/v1/public/articles/example-article/}",
            output,
        )

    def test_bibtex_renderer_omits_empty_fields(self):
        metadata = replace(
            self._metadata(),
            abstract=None,
            doi=None,
            volume=None,
            issue=None,
            first_page=None,
            last_page=None,
            keywords=[],
        )

        output = render_bibtex(metadata)

        self.assertNotIn("doi =", output)
        self.assertNotIn("volume =", output)
        self.assertNotIn("number =", output)
        self.assertNotIn("pages =", output)
        self.assertNotIn("keywords =", output)
        self.assertNotIn("abstract =", output)
        self.assertNotIn("None", output)

    def test_ris_renderer_outputs_journal_record(self):
        output = render_ris(self._metadata())

        self.assertTrue(output.startswith("TY  - JOUR\n"))
        self.assertIn("TI  - Example {Title} & 100%_# \\ Study\n", output)
        self.assertIn("AU  - Smith, John\n", output)
        self.assertIn("AU  - Doe, Jane\n", output)
        self.assertIn("DO  - 10.1234/example\n", output)
        self.assertIn(
            "UR  - https://journal.example.org/api/v1/public/articles/example-article/\n",
            output,
        )
        self.assertIn("KW  - metadata\n", output)
        self.assertIn("KW  - journal exports\n", output)
        self.assertTrue(output.endswith("ER  -\n"))

    def test_ris_renderer_omits_missing_optional_values(self):
        metadata = replace(
            self._metadata(),
            abstract=None,
            doi=None,
            volume=None,
            issue=None,
            first_page=None,
            last_page=None,
            keywords=[],
        )

        output = render_ris(metadata)

        self.assertNotIn("AB  -", output)
        self.assertNotIn("DO  -", output)
        self.assertNotIn("VL  -", output)
        self.assertNotIn("IS  -", output)
        self.assertNotIn("SP  -", output)
        self.assertNotIn("EP  -", output)
        self.assertNotIn("KW  -", output)
        self.assertNotIn("None", output)

    def test_dublin_core_renderer_outputs_valid_namespaced_xml(self):
        output = render_dublin_core_xml(self._metadata())
        root = ET.fromstring(output)

        self.assertIn('xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/"', output)
        self.assertIn('xmlns:dc="http://purl.org/dc/elements/1.1/"', output)
        self.assertIn('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"', output)
        self.assertEqual(root.tag, f"{{{OAI_DC_NAMESPACE}}}dc")
        creators = root.findall(f"{{{DC_NAMESPACE}}}creator")
        identifiers = root.findall(f"{{{DC_NAMESPACE}}}identifier")
        title = root.find(f"{{{DC_NAMESPACE}}}title")

        self.assertEqual([creator.text for creator in creators], ["Smith, John", "Doe, Jane"])
        self.assertIn(
            "https://doi.org/10.1234/example",
            [identifier.text for identifier in identifiers],
        )
        self.assertIn(
            "https://journal.example.org/api/v1/public/articles/example-article/",
            [identifier.text for identifier in identifiers],
        )
        self.assertEqual(title.text, r"Example {Title} & 100%_# \ Study")


class PublishingApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="editor",
            email="editor@example.com",
            password="testpass123",
        )
        self.section_editor_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_EDITOR
        )
        self.user.roles.add(self.section_editor_role)
        self.author = get_user_model().objects.create_user(
            username="author",
            email="api-author@example.com",
            password="testpass123",
        )
        self.section_manager_role, _ = Role.objects.get_or_create(
            name=Role.RoleName.SECTION_MANAGER
        )
        self.manager = get_user_model().objects.create_user(
            username="manager",
            email="manager@example.com",
            password="testpass123",
        )
        self.manager.roles.add(self.section_manager_role)

        self.other_manager = get_user_model().objects.create_user(
            username="other-manager",
            email="other-manager@example.com",
            password="testpass123",
        )
        self.other_manager.roles.add(self.section_manager_role)
        self.section = Section.objects.create(
            name="Artificial Intelligence",
            manager=self.manager,
        )
        self.submission = Submission.objects.create(
            title="Reviewer Recommendation for Journals",
            abstract="An accepted manuscript about reviewer recommendation.",
            language="en",
            author=self.author,
            section=self.section,
            status=Submission.Status.ACCEPTED,
            assigned_editor=self.user,
        )
        self.submission_version = SubmissionVersion.objects.create(
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
        assigned_editor=None,
    ):
        submission = Submission.objects.create(
            title=title,
            abstract=abstract,
            language="en",
            author=self.author,
            section=section or self.section,
            status=status,
            assigned_editor=assigned_editor or self.user,
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
        language="en",
        keywords=None,
        doi=None,
        license_name="",
        license_url="",
        volume="",
        issue="",
        first_page="",
        last_page="",
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
            language=language,
            keywords=keywords if keywords is not None else [],
            doi=doi,
            license_name=license_name,
            license_url=license_url,
            volume=volume,
            issue=issue,
            first_page=first_page,
            last_page=last_page,
            pdf_file=pdf_file,
            status=status,
            published_at=published_at,
            view_count=view_count,
            download_count=download_count,
        )

    def _create_export_article(
        self,
        *,
        slug="exportable-article",
        status=PublishedArticle.Status.PUBLISHED,
        title="Exportable Metadata Article",
        abstract="A published article for citation export.",
        language="en",
        doi="10.5555/exportable",
    ):
        JournalMetadataSettings.objects.update_or_create(
            pk=JournalMetadataSettings.SINGLETON_PK,
            defaults={
                "journal_title": "Public Metadata Journal",
                "publisher_name": "Metadata Publisher",
                "print_issn": "1234-5678",
                "online_issn": "8765-4321",
                "base_url": "https://journal.example.org",
            },
        )
        article = self._create_article(
            status=status,
            slug=slug,
            title=title,
            abstract=abstract,
            language=language,
            keywords=["citation export", "metadata"],
            doi=doi,
            license_name="CC BY 4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            volume="7",
            issue="1",
            first_page="100",
            last_page="112",
            pdf_file="published/articles/exportable.pdf",
        )
        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Ada Lovelace",
            email="ada@example.com",
            order=1,
            is_corresponding=True,
        )
        PublishedArticleAuthor.objects.create(
            article=article,
            full_name="Alan Turing",
            email="alan@example.com",
            order=2,
            is_corresponding=False,
        )
        return article

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
        self.assertEqual(
            str(response.data["source_version"]),
            str(self.submission_version.id),
        )

    def test_unassigned_user_create_draft_endpoint_returns_404(self):
        unassigned_editor = get_user_model().objects.create_user(
            username="unassigned-editor",
            email="unassigned-editor@example.com",
            password="testpass123",
        )
        unassigned_editor.roles.add(self.section_editor_role)
        self.client.force_authenticate(unassigned_editor)

        response = self.client.post(
            f"/api/v1/publishing/submissions/{self.submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 404)

    def test_non_section_editor_create_draft_endpoint_returns_403(self):
        non_editor = get_user_model().objects.create_user(
            username="non-section-editor",
            email="non-section-editor@example.com",
            password="testpass123",
        )
        submission = self._create_submission(assigned_editor=non_editor)
        self.client.force_authenticate(non_editor)

        response = self.client.post(
            f"/api/v1/publishing/submissions/{submission.id}/create-draft/",
        )

        self.assertEqual(response.status_code, 403)
        self.assertIn(
            "Only authorized editorial users can create publication drafts.",
            str(response.data),
        )

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
        self.assertIn("Submission has no versions", str(response.data))

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

    def test_public_list_accepts_section_slug_filter(self):
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="slug-filtered-article",
            section=self.section,
        )

        response = self.client.get(
            f"/api/v1/public/articles/?section={self.section.slug}"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._response_slugs(response), [article.slug])

    def test_public_list_invalid_section_filter_returns_clean_400(self):
        response = self.client.get("/api/v1/public/articles/?section=bad@slug")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid section filter", str(response.data))

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

    def test_public_detail_exposes_safe_ordered_academic_metadata(self):
        article = self._create_export_article()

        response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["authors"],
            ["Ada Lovelace", "Alan Turing"],
        )
        self.assertEqual(
            response.data["keywords"],
            ["citation export", "metadata"],
        )
        self.assertEqual(
            response.data["doi"],
            "10.5555/exportable",
        )
        self.assertEqual(response.data["language"], "en")

        author_details = response.data["author_details"]

        self.assertEqual(
            [author["full_name"] for author in author_details],
            ["Ada Lovelace", "Alan Turing"],
        )
        self.assertEqual(
            [author["order"] for author in author_details],
            [1, 2],
        )
        self.assertTrue(author_details[0]["is_corresponding"])
        self.assertFalse(author_details[1]["is_corresponding"])

        # Public metadata must not expose private contact details.
        for author in author_details:
            self.assertNotIn("email", author)

        # Readers receive controlled endpoints, never storage object keys.
        self.assertNotIn("pdf_file", response.data)
        self.assertIn(
            f"/public/articles/{article.slug}/download/",
            response.data["download_url"],
        )

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

    def test_public_export_bibtex_returns_downloadable_metadata_file(self):
        article = self._create_export_article()

        response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=bibtex"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/x-bibtex; charset=utf-8",
        )
        self.assertEqual(
            response["Content-Disposition"],
            'attachment; filename="exportable-article.bib"',
        )
        content = response.content.decode()
        self.assertIn("@article{exportablearticle,", content)
        self.assertIn("title = {Exportable Metadata Article}", content)
        self.assertIn("author = {Ada Lovelace and Alan Turing}", content)
        self.assertIn("journal = {Public Metadata Journal}", content)
        self.assertIn("doi = {10.5555/exportable}", content)
        self.assertIn(
            "url = {https://journal.example.org/api/v1/public/articles/"
            "exportable-article/}",
            content,
        )

    def test_public_export_ris_returns_downloadable_metadata_file(self):
        article = self._create_export_article()

        response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=ris"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/x-research-info-systems; charset=utf-8",
        )
        self.assertEqual(
            response["Content-Disposition"],
            'attachment; filename="exportable-article.ris"',
        )
        content = response.content.decode()
        self.assertTrue(content.startswith("TY  - JOUR\n"))
        self.assertIn("AU  - Ada Lovelace\n", content)
        self.assertIn("AU  - Alan Turing\n", content)
        self.assertIn("DO  - 10.5555/exportable\n", content)
        self.assertIn("KW  - citation export\n", content)
        self.assertTrue(content.endswith("ER  -\n"))

    def test_public_export_dublin_core_returns_downloadable_xml_file(self):
        article = self._create_export_article()

        response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=dc"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml; charset=utf-8")
        self.assertEqual(
            response["Content-Disposition"],
            'attachment; filename="exportable-article.xml"',
        )
        root = ET.fromstring(response.content.decode())
        creators = root.findall(f"{{{DC_NAMESPACE}}}creator")
        identifiers = root.findall(f"{{{DC_NAMESPACE}}}identifier")

        self.assertEqual(root.tag, f"{{{OAI_DC_NAMESPACE}}}dc")
        self.assertEqual(
            [creator.text for creator in creators],
            ["Ada Lovelace", "Alan Turing"],
        )
        self.assertIn(
            "https://doi.org/10.5555/exportable",
            [identifier.text for identifier in identifiers],
        )
        self.assertIn(
            "https://journal.example.org/api/v1/public/articles/exportable-article/",
            [identifier.text for identifier in identifiers],
        )

    def test_public_export_preserves_arabic_metadata_as_utf8(self):
        title = "تحليل دلالي للمقالات العلمية"
        abstract = "ملخص عربي لاختبار تصدير البيانات الوصفية."
        article = self._create_export_article(
            slug="arabic-export",
            title=title,
            abstract=abstract,
            language="ar",
        )

        bibtex_response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=bibtex"
        )
        ris_response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=ris"
        )
        dc_response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=dc"
        )

        self.assertEqual(bibtex_response.status_code, 200)
        self.assertEqual(ris_response.status_code, 200)
        self.assertEqual(dc_response.status_code, 200)
        self.assertIn("charset=utf-8", bibtex_response["Content-Type"])
        self.assertIn(title, bibtex_response.content.decode("utf-8"))
        self.assertIn(abstract, bibtex_response.content.decode("utf-8"))
        self.assertIn(f"TI  - {title}", ris_response.content.decode("utf-8"))

        root = ET.fromstring(dc_response.content.decode("utf-8"))
        dc_title = root.find(f"{{{DC_NAMESPACE}}}title")
        dc_description = root.find(f"{{{DC_NAMESPACE}}}description")
        self.assertEqual(dc_title.text, title)
        self.assertEqual(dc_description.text, abstract)

    def test_public_export_accepts_supported_format_aliases(self):
        article = self._create_export_article()

        for format_alias in ["bib", "dublin-core", "dublin_core", "xml"]:
            with self.subTest(format_alias=format_alias):
                response = self.client.get(
                    f"/api/v1/public/articles/{article.slug}/export/"
                    f"?format={format_alias}"
                )

                self.assertEqual(response.status_code, 200)

    def test_public_export_unsupported_format_returns_400(self):
        article = self._create_export_article()

        response = self.client.get(
            f"/api/v1/public/articles/{article.slug}/export/?format=jats"
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported export format", str(response.data))

    def test_public_export_missing_format_returns_400(self):
        article = self._create_export_article()

        response = self.client.get(f"/api/v1/public/articles/{article.slug}/export/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported export format", str(response.data))

    def test_public_export_unknown_slug_returns_404(self):
        response = self.client.get(
            "/api/v1/public/articles/unknown-export/export/?format=bibtex"
        )

        self.assertEqual(response.status_code, 404)

    def test_public_export_does_not_expose_unpublished_articles(self):
        draft = self._create_export_article(
            slug="draft-export",
            status=PublishedArticle.Status.DRAFT,
        )
        retracted = self._create_export_article(
            slug="retracted-export",
            status=PublishedArticle.Status.RETRACTED,
            doi="10.5555/retracted-export",
        )

        draft_response = self.client.get(
            f"/api/v1/public/articles/{draft.slug}/export/?format=bibtex"
        )
        retracted_response = self.client.get(
            f"/api/v1/public/articles/{retracted.slug}/export/?format=bibtex"
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
        self.client.force_authenticate(self.manager)
        article = PublishingService.create_draft_from_submission(
            actor=self.manager,
            submission=self.submission,
        )
        issue = create_current_published_issue()

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], PublishedArticle.Status.PUBLISHED)
        self.assertIsNotNone(response.data["published_at"])
        article.refresh_from_db()
        self.assertEqual(article.publication_issue, issue)
        self.assertEqual(article.volume, issue.volume)
        self.assertEqual(article.issue, issue.number)

    def test_patch_cannot_change_article_status_directly(self):
        article = PublishingService.create_draft_from_submission(
            actor=self.manager,
            submission=self.submission,
        )
        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            ),
            {"status": PublishedArticle.Status.PUBLISHED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        article.refresh_from_db()
        self.assertEqual(article.status, PublishedArticle.Status.DRAFT)
        self.assertEqual(
            response.data["status"],
            PublishedArticle.Status.DRAFT,
        )

    def test_section_editor_cannot_list_publication_records(self):
        PublishingService.create_draft_from_submission(
            actor=self.user,
            submission=self.submission,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse("publishing-article-list")
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


    def test_section_editor_cannot_retrieve_publication_record(self):
        article = PublishingService.create_draft_from_submission(
            actor=self.user,
            submission=self.submission,
        )
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            )
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


    def test_section_editor_cannot_update_publication_record(self):
        article = PublishingService.create_draft_from_submission(
            actor=self.user,
            submission=self.submission,
        )
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            ),
            {"title": "Unauthorized metadata change"},
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

        article.refresh_from_db()
        self.assertNotEqual(
            article.title,
            "Unauthorized metadata change",
        )

    def test_publish_endpoint_rejects_already_published_article(self):
        self.client.force_authenticate(self.manager)
        article = self._create_article(
            status=PublishedArticle.Status.PUBLISHED,
            slug="already-published",
        )

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("already published", str(response.data))

    def test_publish_endpoint_rejects_retracted_article(self):
        self.client.force_authenticate(self.manager)
        article = self._create_article(
            status=PublishedArticle.Status.RETRACTED,
            slug="retracted-management",
        )

        response = self.client.post(f"/api/v1/publishing/articles/{article.id}/publish/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("Retracted articles cannot be published", str(response.data))

    def test_manager_can_create_draft_for_managed_section(self):
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "publishing-create-draft",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_unrelated_manager_cannot_create_draft(self):
        self.client.force_authenticate(self.other_manager)

        response = self.client.post(
            reverse(
                "publishing-create-draft",
                args=[self.submission.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_can_publish_article_from_managed_section(self):
        article = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="managed-draft",
        )
        create_current_published_issue()
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "publishing-article-publish",
                args=[article.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        article.refresh_from_db()
        self.assertEqual(
            article.status,
            PublishedArticle.Status.PUBLISHED,
        )

    def test_unrelated_manager_cannot_publish_article(self):
        article = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="unrelated-manager-draft",
        )
        create_current_published_issue()
        self.client.force_authenticate(self.other_manager)

        response = self.client.post(
            reverse(
                "publishing-article-publish",
                args=[article.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_section_editor_cannot_publish_article(self):
        article = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="section-editor-draft",
        )
        create_current_published_issue()
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse(
                "publishing-article-publish",
                args=[article.id],
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_list_is_limited_to_managed_sections(self):
        managed_article = self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="managed-list-draft",
        )
        other_section = Section.objects.create(
            name="Other Managed Section",
            manager=self.other_manager,
        )
        self._create_article(
            status=PublishedArticle.Status.DRAFT,
            slug="other-managed-list-draft",
            section=other_section,
        )

        self.client.force_authenticate(self.manager)

        response = self.client.get(
            reverse("publishing-article-list")
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        returned_ids = {
            item["id"]
            for item in response.data["results"]
        }

        self.assertEqual(
            returned_ids,
            {str(managed_article.id)},
        )
    def test_patch_cannot_replace_pdf_object_key(self):
        article = PublishingService.create_draft_from_submission(
            actor=self.manager,
            submission=self.submission,
        )
        original_object_key = article.pdf_file

        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            ),
            {
                "pdf_file": (
                    "submissions/unrelated/v1/full/replacement.pdf"
                )
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "accepted submission version",
            str(response.data),
        )

        article.refresh_from_db()

        self.assertEqual(
            article.pdf_file,
            original_object_key,
        )

    def test_published_article_cannot_be_detached_or_moved_to_draft_issue(
        self,
    ):
        article = PublishingService.create_draft_from_submission(
            actor=self.manager,
            submission=self.submission,
        )
        published_issue = create_current_published_issue()
        article = PublishingService.publish_article(article)

        draft_issue = Issue.objects.create(
            title="Future Draft Issue",
            volume="2",
            number="1",
            year=timezone.now().year,
            status=Issue.Status.DRAFT,
        )

        self.client.force_authenticate(self.manager)
        url = reverse(
            "publishing-article-detail",
            args=[article.id],
        )

        detach_response = self.client.patch(
            url,
            {"publication_issue": None},
            format="json",
        )
        move_response = self.client.patch(
            url,
            {
                "publication_issue": str(draft_issue.id),
            },
            format="json",
        )

        self.assertEqual(
            detach_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "must remain assigned",
            str(detach_response.data),
        )

        self.assertEqual(
            move_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn(
            "status 'published'",
            str(move_response.data),
        )

        article.refresh_from_db()

        self.assertEqual(
            article.publication_issue,
            published_issue,
        )

    def test_linked_issue_controls_volume_and_issue_metadata(self):
        article = PublishingService.create_draft_from_submission(
            actor=self.manager,
            submission=self.submission,
        )
        publication_issue = Issue.objects.create(
            title="Metadata Synchronization Issue",
            volume="8",
            number="4",
            year=timezone.now().year,
            status=Issue.Status.PUBLISHED,
            published_at=timezone.now(),
        )

        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            reverse(
                "publishing-article-detail",
                args=[article.id],
            ),
            {
                "publication_issue": str(
                    publication_issue.id
                ),
                "volume": "incorrect-volume",
                "issue": "incorrect-number",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_200_OK,
        )

        article.refresh_from_db()

        self.assertEqual(
            article.publication_issue,
            publication_issue,
        )
        self.assertEqual(
            article.volume,
            publication_issue.volume,
        )
        self.assertEqual(
            article.issue,
            publication_issue.number,
        )

class PublicJournalCustomizationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("public-journal")

        self.journal = JournalMetadataSettings.get_current()
        self.journal.journal_title = "University Research Journal"
        self.journal.short_name = "URJ"
        self.journal.description = "A configurable scientific journal."
        self.journal.primary_color = "#24567A"
        self.journal.default_language = "en"
        self.journal.publisher_name = "Example University"
        self.journal.online_issn = "1234-5678"
        self.journal.access_policy = "Open Access"
        self.journal.peer_review_policy = "Double-blind peer review"
        self.journal.publication_frequency = "Quarterly"
        self.journal.default_license_name = "CC BY 4.0"
        self.journal.default_license_url = (
            "https://creativecommons.org/licenses/by/4.0/"
        )
        self.journal.save()

    def tearDown(self):
        if self.journal.logo:
            self.journal.logo.delete(save=False)

    def test_public_journal_configuration_is_available_anonymously(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "University Research Journal")
        self.assertEqual(response.data["short_name"], "URJ")
        self.assertEqual(response.data["primary_color"], "#24567A")
        self.assertEqual(response.data["default_language"], "en")
        self.assertEqual(response.data["publisher"], "Example University")
        self.assertEqual(response.data["issn"], "1234-5678")
        self.assertEqual(response.data["license"], "CC BY 4.0")
        self.assertEqual(
            response.data["license_url"],
            "https://creativecommons.org/licenses/by/4.0/",
        )
        self.assertIsNone(response.data["logo_url"])

    def test_logo_url_is_absolute_when_logo_exists(self):
        self.journal.logo = SimpleUploadedFile(
            name="test-journal-logo.png",
            content=b"test-logo-content",
            content_type="image/png",
        )
        self.journal.save(update_fields=["logo", "updated_at"])

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            response.data["logo_url"].startswith(
                "http://testserver/media/journal/branding/"
            )
        )

    def test_internal_ranking_configuration_is_not_public(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn(
            "priority_waiting_age_weight",
            response.data,
        )
        self.assertNotIn(
            "priority_action_urgency_weight",
            response.data,
        )
        self.assertNotIn("oai_admin_email", response.data)