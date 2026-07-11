import uuid

from django.conf import settings
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError
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


class SectionEditorMembership(models.Model):
    """
    Associates a Section Editor with the section in which they are
    eligible to receive manuscript assignments.

    The global SECTION_EDITOR role grants the capability, while this
    membership defines its section-level scope.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.PROTECT,
        related_name="editor_memberships",
    )
    editor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="section_editor_memberships",
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="section_editor_memberships_created",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()

        if not self.editor_id:
            return

        from apps.accounts.models import Role, User

        if not self.editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValidationError(
                {
                    "editor": (
                        "The selected user must have the "
                        "SECTION_EDITOR role."
                    )
                }
            )

        if self.editor.status != User.Status.ACTIVE:
            raise ValidationError(
                {
                    "editor": (
                        "An inactive user cannot be added as a "
                        "Section Editor."
                    )
                }
            )

    def __str__(self):
        return f"{self.editor} — {self.section}"

    class Meta:
        ordering = ["section__name", "editor__username"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "editor"],
                name="unique_section_editor_membership",
            ),
        ]
        indexes = [
            models.Index(
                fields=["section", "is_active"],
                name="idx_section_editor_active",
            ),
            models.Index(
                fields=["editor", "is_active"],
                name="idx_editor_section_active",
            ),
        ]

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
    
    def save(self, *args, **kwargs):
        if not self.slug:
            slug_source = self.title or f"vol-{self.volume}-issue-{self.number}-{self.year}"
            self.slug = build_unique_slug(
                type(self).objects.all(),
                slug_source,
                fallback="issue",
                max_length=self._meta.get_field("slug").max_length,
                exclude_pk=self.pk,
            )

        if self.is_current:
            type(self).objects.exclude(pk=self.pk).filter(is_current=True).update(
                is_current=False,
            )

        super().save(*args, **kwargs)

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