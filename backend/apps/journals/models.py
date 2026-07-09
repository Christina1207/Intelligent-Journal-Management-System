import uuid

from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q
from apps.common.slugging import build_unique_slug


issn_validator = RegexValidator(
    regex=r"^\d{4}-\d{4}$",
    message="ISSN must be in the format XXXX-XXXX (e.g. 1234-5678).",
)


class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)

    slug = models.SlugField(
        max_length=280,
        unique=True,
        help_text="Stable public URL slug for this section.",
    )

    description = models.TextField(blank=True)
    issn = models.CharField(
        max_length=9,
        blank=True,
        validators=[issn_validator],
    )
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_sections",
        help_text="The section manager responsible for this section.",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive sections do not accept new submissions.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    last_clustered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Timestamp of the last successful BERTopic clustering run for this section."
        ),
    )

    def __str__(self):
        return self.name
    
    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = build_unique_slug(
                type(self).objects.all(),
                self.name,
                fallback="section",
                max_length=self._meta.get_field("slug").max_length,
                exclude_pk=self.pk,
            )

        super().save(*args, **kwargs)

    class Meta:
        ordering = ["name"]


class Issue(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=280,
        unique=True,
        help_text="Stable public URL slug for this issue.",
    )
    volume = models.CharField(max_length=50, blank=True, default="")
    number = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Issue number within the volume.",
    )
    year = models.PositiveIntegerField()
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    published_at = models.DateTimeField(blank=True, null=True)
    is_current = models.BooleanField(
        default=False,
        help_text="Marks the currently featured public issue.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        label_parts = []
        if self.volume:
            label_parts.append(f"Vol. {self.volume}")
        if self.number:
            label_parts.append(f"No. {self.number}")
        label_parts.append(str(self.year))

        return f"{self.title} ({', '.join(label_parts)})"

    class Meta:
        ordering = [
            models.F("published_at").desc(nulls_last=True),
            "-year",
            "volume",
            "number",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["volume", "number", "year"],
                name="unique_issue_volume_number_year",
            ),
            models.UniqueConstraint(
                fields=["is_current"],
                condition=Q(is_current=True),
                name="unique_current_issue",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "published_at"], name="idx_issue_status_pub"),
            models.Index(fields=["slug"], name="idx_issue_slug"),
        ]


class JournalMetadataSettings(models.Model):
    """
    Deployment-level journal metadata used to initialize publication records
    and power the public reader portal.
    """

    SINGLETON_PK = 1

    id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=SINGLETON_PK,
        editable=False,
    )
    journal_title = models.CharField(max_length=255, default="Untitled Journal")
    short_name = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    publisher_name = models.CharField(max_length=255, blank=True, default="")
    print_issn = models.CharField(
        max_length=9,
        blank=True,
        default="",
        validators=[issn_validator],
    )
    online_issn = models.CharField(
        max_length=9,
        blank=True,
        default="",
        validators=[issn_validator],
    )
    base_url = models.URLField(max_length=500, blank=True, default="")
    default_language = models.CharField(max_length=10, default="en")
    default_license_name = models.CharField(max_length=255, blank=True, default="")
    default_license_url = models.URLField(max_length=500, blank=True, default="")

    access_policy = models.TextField(blank=True, default="")
    peer_review_policy = models.TextField(blank=True, default="")
    publication_frequency = models.CharField(max_length=255, blank=True, default="")

    oai_repository_name = models.CharField(max_length=255, blank=True, default="")
    oai_admin_email = models.EmailField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def get_current(cls):
        settings, _ = cls.objects.get_or_create(pk=cls.SINGLETON_PK)
        return settings

    def save(self, *args, **kwargs):
        self.pk = self.SINGLETON_PK
        super().save(*args, **kwargs)

    def __str__(self):
        return self.journal_title

    class Meta:
        verbose_name = "Journal metadata settings"
        verbose_name_plural = "Journal metadata settings"