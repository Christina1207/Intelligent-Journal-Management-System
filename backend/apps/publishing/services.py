from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import transaction
from django.http import Http404
from django.utils import timezone
from django.utils.text import slugify

from apps.core.storage import StorageService
from apps.submissions.models import Submission, SubmissionVersion

from .models import PublishedArticle


class PublicDownloadUnavailable(Exception):
    pass


class PublishingService:
    PUBLIC_DOWNLOAD_EXPIRES_IN_SECONDS = 3600

    @staticmethod
    @transaction.atomic
    def create_draft_from_submission(submission: Submission) -> PublishedArticle:
        """
        Create the public scholarly-record draft for an accepted submission.
        The submission remains the internal workflow and audit record.
        """
        submission = (
            Submission.objects.select_for_update()
            .select_related("section")
            .get(pk=submission.pk)
        )

        if submission.status != Submission.Status.ACCEPTED:
            raise ValidationError("Only accepted submissions can be moved to publishing.")

        if PublishedArticle.objects.filter(submission=submission).exists():
            raise ValidationError(
                "This submission already has a published article or publication draft."
            )

        accepted_version = PublishingService._get_latest_accepted_version(submission)
        if accepted_version is None:
            raise ValidationError(
                "Accepted submission has no accepted submission version to publish."
            )

        if not accepted_version.file:
            raise ValidationError(
                "Accepted submission version has no manuscript file to publish."
            )

        article = PublishedArticle.objects.create(
            submission=submission,
            section=submission.section,
            title=submission.title,
            slug=PublishingService._generate_unique_slug(submission.title),
            abstract=submission.abstract,
            keywords=PublishingService._extract_keywords(submission),
            pdf_file=accepted_version.file or None,
            status=PublishedArticle.Status.DRAFT,
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
    def _get_latest_accepted_version(submission: Submission):
        return (
            submission.versions.filter(decision=SubmissionVersion.Decision.ACCEPTED)
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
    def _generate_unique_slug(base_slug: str) -> str:
        base = slugify(base_slug) or "article"
        max_length = PublishedArticle._meta.get_field("slug").max_length
        slug = base[:max_length]
        suffix = 2

        while PublishedArticle.objects.filter(slug=slug).exists():
            suffix_text = f"-{suffix}"
            slug = f"{base[: max_length - len(suffix_text)]}{suffix_text}"
            suffix += 1

        return slug
