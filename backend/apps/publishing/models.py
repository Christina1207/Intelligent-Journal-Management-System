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
    section = models.ForeignKey(
        "journals.Section",
        on_delete=models.PROTECT,
        related_name="published_articles",
    )
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=550, unique=True)
    abstract = models.TextField(blank=True)
    keywords = models.JSONField(default=list, blank=True)
    doi = models.CharField(max_length=255, blank=True, null=True, unique=True)
    pdf_file = models.FileField(
        upload_to="published/articles/",
        max_length=500,
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    published_at = models.DateTimeField(blank=True, null=True)
    view_count = models.PositiveIntegerField(default=0)
    download_count = models.PositiveIntegerField(default=0)
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
