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

class ReviewerApplication(models.Model):
    """
    Represents a user's request to become an approved reviewer
    for one journal section.

    An approved application results in the user receiving the REVIEWER
    role and a ReviewerProfile configured for the selected section.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="reviewer_application",
    )

    section = models.ForeignKey(
        "journals.Section",
        on_delete=models.PROTECT,
        related_name="reviewer_applications",
        help_text=(
            "The single journal section for which the applicant "
            "is requesting reviewer approval."
        ),
    )

    keywords = ArrayField(
        base_field=models.CharField(max_length=100),
        default=list,
    )

    biography = models.TextField()

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )

    decision_note = models.TextField(
        blank=True,
        default="",
    )

    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewer_applications_reviewed",
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    def __str__(self):
        return (
            f"{self.user.email} — {self.section.name} "
            f"({self.get_status_display()})"
        )

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(
                fields=["status", "submitted_at"],
                name="rev_app_status_time_idx",
            ),
        ]

class ReviewerProfile(models.Model):
    """
    Stores expertise, section eligibility, publications, and embedding data
    for an approved reviewer.

    Reviewer profiles are created when reviewer applications are approved.
    The existing get-or-create behavior is retained as a defensive fallback
    for legacy reviewer accounts.
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