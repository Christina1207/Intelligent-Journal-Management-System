import uuid
from django.db import models
from django.core.validators import RegexValidator
from django.conf import settings


issn_validator = RegexValidator(
    regex=r"^\d{4}-\d{4}$",
    message="ISSN must be in the format XXXX-XXXX (e.g. 1234-5678).",
)


class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
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
    help_text="Timestamp of the last successful BERTopic clustering run for this section.",
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]

class JournalMetadataSettings(models.Model):
    """
    Deployment-level journal metadata used to initialize publication records.
    """

    SINGLETON_PK = 1

    id = models.PositiveSmallIntegerField(
        primary_key=True,
        default=SINGLETON_PK,
        editable=False,
    )
    journal_title = models.CharField(max_length=255, default="Untitled Journal")
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
