import uuid
from django.contrib.auth.models import AbstractUser
from django.contrib.postgres.fields import ArrayField
from django.db import models
from pgvector.django import VectorField


class Role(models.Model):
    class RoleName(models.TextChoices):
        AUTHOR = "AUTHOR", "Author"
        REVIEWER = "REVIEWER", "Reviewer"
        SECTION_MANAGER = "SECTION_MANAGER", "Section Manager"
        SECTION_EDITOR = "SECTION_EDITOR", "Section Editor"
        EDITOR_IN_CHIEF = "EDITOR_IN_CHIEF", "Editor in Chief"
        ADMIN = "ADMIN", "Admin"
        READER = "READER", "Reader"

    name = models.CharField(
        max_length=50,
        choices=RoleName.choices,
        unique=True,
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]



class User(AbstractUser):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        INACTIVE = "INACTIVE", "Inactive"
        
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    orcid = models.CharField(max_length=19, blank=True, default="") # format: 0000-0000-0000-0000
    affiliation = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    roles = models.ManyToManyField(Role, blank=True, related_name="users")

    @property
    def status(self) -> str:
        """
        Backward-compatible API representation of Django's authoritative
        account activation field.
        """
        if self.is_active:
            return self.Status.ACTIVE
        return self.Status.INACTIVE
    REQUIRED_FIELDS = ["email", "first_name", "last_name"]

    def __str__(self):
        return f"{self.username} <{self.email}>"

    def has_role(self, role_name: str) -> bool:
        """Convenience method for role checks throughout the codebase."""
        return self.roles.filter(name=role_name).exists()

    class Meta:
        ordering = ["username"]


class ReviewerProfile(models.Model):
    """
    Stores reviewer-specific expertise data and ORCID publication cache.
    One row per reviewer, created lazily on first sync or task execution.

    # TODO: ReviewerProfile creation should be moved to UserService.assign_role()
    # once the reviewer application workflow is implemented (deferred to Sprint 4).
    # Currently created via get_or_create in the Celery task and sync endpoint.
    """

    class SyncStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    user = models.OneToOneField(
        User,
        on_delete=models.PROTECT,
        related_name="reviewer_profile",
    )
    sections = models.ManyToManyField(
        "journals.Section",
        related_name="reviewer_profiles",
        blank=True,
        help_text=(
            "Journal sections in which this reviewer is approved "
            "to review manuscripts."
        ),
    )
    keywords = ArrayField(
        base_field=models.CharField(max_length=100),
        blank=True,
        default=list,
    )
    biography = models.TextField(blank=True, default="")
    expertise_embedding = VectorField(
        dimensions=384,
        null=True,
        blank=True,
        # TODO: Add pgvector IVFFlat or HNSW index on this field once
        # reviewer count justifies it. Defer to Phase 7 hardening.
    )
    publications = models.JSONField(
        default=list,
        # Raw ORCID works data. Structure: [{title, year, doi}]
        # TODO: If publication querying becomes a requirement (filtering, search),
        # normalize into a separate ReviewerPublication model. Defer to Sprint 4.
    )
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_status = models.CharField(
        max_length=10,
        choices=SyncStatus.choices,
        default=SyncStatus.PENDING,
    )

    def __str__(self):
        return f"ReviewerProfile for {self.user.email}"

    class Meta:
        ordering = ["-last_synced_at"]