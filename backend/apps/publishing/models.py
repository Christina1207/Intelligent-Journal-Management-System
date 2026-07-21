import uuid

from django.db import models


class PublishedArticle(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        RETRACTED = "retracted", "Retracted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        "submissions.Submission",
        on_delete=models.PROTECT,
        related_name="published_article",
    )
    source_version = models.ForeignKey(
        "submissions.SubmissionVersion",
        on_delete=models.PROTECT,
        related_name="published_articles",
        null=True,
        blank=True,
    )
    section = models.ForeignKey(
        "journals.Section",
        on_delete=models.PROTECT,
        related_name="published_articles",
    )
    publication_issue = models.ForeignKey(
        "journals.Issue",
        on_delete=models.PROTECT,
        related_name="articles",
        null=True,
        blank=True,
        help_text="Structured journal issue this article belongs to.",
    )
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=550, unique=True)
    abstract = models.TextField(blank=True)
    language = models.CharField(max_length=10, blank=True, default="")
    keywords = models.JSONField(default=list, blank=True)
    doi = models.CharField(max_length=255, blank=True, null=True, unique=True)
    license_name = models.CharField(max_length=255, blank=True, default="")
    license_url = models.URLField(max_length=500, blank=True, default="")
    volume = models.CharField(max_length=50, blank=True, default="")
    issue = models.CharField(max_length=100, blank=True, default="")
    first_page = models.CharField(max_length=50, blank=True, default="")
    last_page = models.CharField(max_length=50, blank=True, default="")
    pdf_file = models.CharField(
        max_length=500,
        blank=True,
        default="",
        help_text="Private MinIO object key for the published PDF.",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    published_at = models.DateTimeField(blank=True, null=True)
    view_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
    metadata_updated_at = models.DateTimeField(auto_now=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} [{self.status}]"

    class Meta:
        ordering = [
            models.F("published_at").desc(nulls_last=True),
            "-created_at",
        ]
        indexes = [
            models.Index(fields=["status", "published_at"], name="idx_article_status_pub"),
            models.Index(fields=["section", "status"], name="idx_article_section_status"),
        ]

class PublishedArticleAuthor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    article = models.ForeignKey(
        PublishedArticle,
        on_delete=models.CASCADE,
        related_name="authors",
    )
    full_name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default="")
    orcid = models.CharField(max_length=19, blank=True, default="")
    affiliation = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    order = models.PositiveIntegerField()
    is_corresponding = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.full_name} ({self.article})"

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["article", "order"],
                name="unique_published_author_order",
            ),
        ]
