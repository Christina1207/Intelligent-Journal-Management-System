from django.core.exceptions import ObjectDoesNotExist, PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils import timezone
from functools import partial

from apps.accounts.models import Role
from apps.core.storage import StorageService
from apps.journals.models import JournalMetadataSettings
from apps.submissions.models import Submission, SubmissionVersion
from apps.common.slugging import build_unique_slug
from apps.journals.models import Issue

from .models import PublishedArticle, PublishedArticleAuthor


class PublicDownloadUnavailable(Exception):
    pass


class IssueLifecycleService:
    @staticmethod
    def open_issue(*, issue: Issue) -> Issue:
        try:
            with transaction.atomic():
                issue = (
                    Issue.objects
                    .select_for_update()
                    .get(pk=issue.pk)
                )

                if issue.status != Issue.Status.DRAFT:
                    raise ValidationError(
                        "Only a draft issue can be opened."
                    )

                metadata_errors = {}

                if not issue.title.strip():
                    metadata_errors["title"] = (
                        "Title is required before opening the issue."
                    )

                if not issue.volume.strip():
                    metadata_errors["volume"] = (
                        "Volume is required before opening the issue."
                    )

                if not issue.number.strip():
                    metadata_errors["number"] = (
                        "Issue number is required before opening the issue."
                    )

                if metadata_errors:
                    raise ValidationError(metadata_errors)

                current_issue = (
                    Issue.objects
                    .select_for_update()
                    .filter(is_current=True)
                    .exclude(pk=issue.pk)
                    .first()
                )

                if current_issue is not None:
                    raise ValidationError(
                        "Close the current issue before opening another one."
                    )

                issue.status = Issue.Status.PUBLISHED
                issue.is_current = True
                issue.published_at = timezone.now()
                issue.save(
                    update_fields=[
                        "status",
                        "is_current",
                        "published_at",
                        "updated_at",
                    ]
                )

                return issue

        except IntegrityError as exc:
            raise ValidationError(
                "Another issue became current while this issue "
                "was being opened. Refresh and try again."
            ) from exc

    @staticmethod
    @transaction.atomic
    def close_issue(*, issue: Issue) -> Issue:
        issue = (
            Issue.objects
            .select_for_update()
            .get(pk=issue.pk)
        )

        if (
            issue.status != Issue.Status.PUBLISHED
            or not issue.is_current
        ):
            raise ValidationError(
                "Only the current open issue can be closed."
            )

        has_draft_articles = (
            issue.articles
            .select_for_update()
            .filter(status=PublishedArticle.Status.DRAFT)
            .exists()
        )

        if has_draft_articles:
            raise ValidationError(
                "This issue still contains publication drafts. "
                "Publish or remove them before closing the issue."
            )

        issue.status = Issue.Status.ARCHIVED
        issue.is_current = False
        issue.save(
            update_fields=[
                "status",
                "is_current",
                "updated_at",
            ]
        )

        return issue

class PublishingService:
    PUBLIC_DOWNLOAD_EXPIRES_IN_SECONDS = 3600

    @staticmethod
    @transaction.atomic
    def create_draft_from_submission(
        *,
        actor,
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

        role_names = set(
            actor.roles.values_list("name", flat=True)
        ) if getattr(actor, "is_authenticated", False) else set()

        has_global_access = (
            getattr(actor, "is_superuser", False)
            or Role.RoleName.EDITOR_IN_CHIEF in role_names
            or Role.RoleName.ADMIN in role_names
        )

        manages_submission_section = (
            Role.RoleName.SECTION_MANAGER in role_names
            and submission.section.manager_id == actor.id
        )

        is_assigned_section_editor = (
            Role.RoleName.SECTION_EDITOR in role_names
            and submission.assigned_editor_id == actor.id
        )

        if not (
            has_global_access
            or manages_submission_section
            or is_assigned_section_editor
        ):
            raise PermissionDenied(
                "You cannot create a publishing draft for this submission."
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
    def publish_article(
        article: PublishedArticle,
    ) -> PublishedArticle:
        article = (
            PublishedArticle.objects
            .select_for_update()
            .get(pk=article.pk)
        )

        if article.status == PublishedArticle.Status.PUBLISHED:
            raise ValidationError(
                "This article is already published."
            )

        if article.status == PublishedArticle.Status.RETRACTED:
            raise ValidationError(
                "Retracted articles cannot be published."
            )

        if article.status != PublishedArticle.Status.DRAFT:
            raise ValidationError(
                "Only draft articles can be published."
            )

        if article.publication_issue_id:
            publication_issue = (
                Issue.objects
                .select_for_update()
                .get(pk=article.publication_issue_id)
            )
        else:
            publication_issue = (
                Issue.objects
                .select_for_update()
                .filter(
                    is_current=True,
                    status=Issue.Status.PUBLISHED,
                )
                .first()
            )

            if publication_issue is None:
                raise ValidationError(
                    "Assign the article to a published issue or "
                    "configure a current published issue before "
                    "publishing."
                )

        if (
            publication_issue.status != Issue.Status.PUBLISHED
            or not publication_issue.is_current
        ):
            raise ValidationError(
                "Articles can only be published in the current open issue."
            )

        article.publication_issue = publication_issue
        article.volume = publication_issue.volume
        article.issue = publication_issue.number
        article.status = PublishedArticle.Status.PUBLISHED
        article.published_at = timezone.now()

        article.save(
            update_fields=[
                "publication_issue",
                "volume",
                "issue",
                "status",
                "published_at",
                "updated_at",
            ]
        )
        from apps.notifications.tasks import (
            send_article_published_email,
        )

        transaction.on_commit(
            partial(
                send_article_published_email.delay,
                str(article.id),
            ),
            robust=True,
        )

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

        object_name = (article.pdf_file or "").strip()
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
        author_keywords = list(submission.keywords or [])

        if author_keywords:
            return author_keywords

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
        for coauthor in submission.coauthors.all():
            PublishedArticleAuthor.objects.update_or_create(
                article=article,
                order=coauthor.order,
                defaults={
                    "full_name": coauthor.full_name,
                    "email": coauthor.email,
                    "orcid": coauthor.orcid,
                    "affiliation": coauthor.affiliation,
                    "country": coauthor.country,
                    "is_corresponding": False,
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
