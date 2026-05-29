import uuid
from django.db import models
from django.core.validators import RegexValidator


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
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive sections do not accept new submissions.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]