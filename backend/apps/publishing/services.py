from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.db import transaction
from django.http import Http404
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.storage import StorageService
from apps.journals.models import JournalMetadataSettings
from apps.submissions.models import Submission, SubmissionVersion
from apps.common.slugging import build_unique_slug

from .models import PublishedArticle, PublishedArticleAuthor


class PublicDownloadUnavailable(Exception):
    pass


class PublishingService:
    PUBLIC_DOWNLOAD_EXPIRES_IN_SECONDS = 3600

    @staticmethod
    @transaction.atomic
    def create_draft_from_submission(
        *,
        editor,
        submission: Submission,
    ) -> PublishedArticle:
        """
        Create the public scholarly-record draft for an accepted submission.
        The submission remains the internal workflow and audit record.
        """
        submission = (
            Submission.objects.select_for_update()
            .select_related("section", "author")
            .get(pk=submission.pk)
        )

        if not getattr(editor, "is_authenticated", False) or not editor.has_role(
            Role.RoleName.SECTION_EDITOR
        ):
            raise PermissionDenied("Only section editors can create publishing drafts.")

        if submission.assigned_editor_id != editor.id:
            raise PermissionDenied(
                "Only the assigned section editor can create a publishing draft "
                "for this submission."
            )

        if submission.status != Submission.Status.ACCEPTED:
            raise ValidationError(
                "Only accepted submissions can be moved to publishing. "
                f"Current status: {submission.status}"
            )

        if PublishedArticle.objects.filter(submission=submission).exists():
            raise ValidationError(
                "This submission already has a published article or publication draft."
            )

        latest_version = PublishingService._get_latest_version(submission)
        if latest_version is None:
            raise ValidationError("Submission has no versions to publish.")

        if latest_version.decision != SubmissionVersion.Decision.ACCEPTED:
            raise ValidationError(
                "Only the latest accepted version can be moved to publishing."
            )

        if not latest_version.file:
            raise ValidationError(
                "Accepted submission version has no manuscript file to publish."
            )

        journal_settings = JournalMetadataSettings.get_current()

        article = PublishedArticle.objects.create(
            submission=submission,
            source_version=latest_version,
            section=submission.section,
            title=submission.title,
            slug=PublishingService._generate_unique_slug(submission.title),
            abstract=submission.abstract,
            language=submission.language or journal_settings.default_language,
            keywords=PublishingService._extract_keywords(submission),
            license_name=journal_settings.default_license_name,
            license_url=journal_settings.default_license_url,
            pdf_file=latest_version.file,
            status=PublishedArticle.Status.DRAFT,
        )
        PublishingService._initialize_author_snapshots(
            article=article,
            submission=submission,
        )

        return article

    @staticmethod
    @transaction.atomic
    def publish_article(article: PublishedArticle) -> PublishedArticle:
        article = PublishedArticle.objects.select_for_update().get(pk=article.pk)

        if article.status == PublishedArticle.Status.PUBLISHED:
            raise ValidationError("This article is already published.")

        if article.status == PublishedArticle.Status.RETRACTED:
            raise ValidationError("Retracted articles cannot be published.")

        if article.status != PublishedArticle.Status.DRAFT:
            raise ValidationError("Only draft articles can be published.")

        article.status = PublishedArticle.Status.PUBLISHED
        article.published_at = timezone.now()
        article.save(update_fields=["status", "published_at", "updated_at"])

        return article

    @staticmethod
    def get_public_download_data(
        article: PublishedArticle,
        *,
        storage_service=None,
        expires_in_seconds: int = PUBLIC_DOWNLOAD_EXPIRES_IN_SECONDS,
    ) -> dict:
        if article.status != PublishedArticle.Status.PUBLISHED:
            raise Http404("Article not found.")

        object_name = article.pdf_file.name if article.pdf_file else ""
        if not object_name:
            raise Http404("Article PDF is not available.")

        storage = storage_service or StorageService()
        try:
            download_url = storage.get_public_url(
                object_name,
                expires_in_seconds=expires_in_seconds,
            )
        except Exception as exc:
            raise PublicDownloadUnavailable(
                "Article download is temporarily unavailable."
            ) from exc

        return {
            "download_url": download_url,
            "expires_in": expires_in_seconds,
        }

    @staticmethod
    def _get_latest_version(submission: Submission):
        return (
            submission.versions.select_for_update()
            .order_by("-version_number")
            .first()
        )

    @staticmethod
    def _extract_keywords(submission: Submission) -> list:
        try:
            return list(submission.topic.keywords or [])
        except ObjectDoesNotExist:
            return []

    @staticmethod
    def _initialize_author_snapshots(
        *,
        article: PublishedArticle,
        submission: Submission,
    ) -> None:
        if article.authors.exists():
            return

        author = submission.author
        full_name = author.get_full_name().strip() or author.username or author.email

        PublishedArticleAuthor.objects.update_or_create(
            article=article,
            order=1,
            defaults={
                "full_name": full_name,
                "email": author.email,
                "orcid": author.orcid,
                "affiliation": author.affiliation,
                "country": author.country,
                "is_corresponding": True,
            },
        )

    @staticmethod
    def _generate_unique_slug(base_slug: str) -> str:
        return build_unique_slug(
            PublishedArticle.objects.all(),
            base_slug,
            fallback="article",
            max_length=PublishedArticle._meta.get_field("slug").max_length,
        )
