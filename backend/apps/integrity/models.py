import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class PlagiarismScreening(models.Model):
    """
    One execution of the plagiarism-detection pipeline for a submission
    version.

    Multiple historical screenings may exist, but a submission version
    may have only one queued or running screening at a time.
    """

    class Status(models.TextChoices):
        QUEUED = "QUEUED", "Queued"
        RUNNING = "RUNNING", "Running"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    submission_version = models.ForeignKey(
        "submissions.SubmissionVersion",
        on_delete=models.PROTECT,
        related_name="plagiarism_screenings",
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="requested_plagiarism_screenings",
        null=True,
        blank=True,
        help_text=(
            "User who requested the screening. Null for automatically "
            "scheduled screenings or when the user no longer exists."
        ),
    )

    celery_task_id = models.CharField(
        max_length=255,
        blank=True,
        default="",
    )

    source_type = models.CharField(
        max_length=100,
        help_text="Comparison-corpus source type used by the pipeline.",
    )

    pipeline_version = models.CharField(
        max_length=128,
        help_text=(
            "Version or source commit of the plagiarism pipeline."
        ),
    )

    checkpoint_id = models.CharField(
        max_length=255,
        help_text="Identity of the verifier checkpoint used.",
    )

    report_schema_version = models.CharField(
        max_length=64,
        blank=True,
        default="",
    )

    summary = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Small report summary suitable for queue and triage views."
        ),
    )

    report = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Complete versioned plagiarism report and supporting evidence."
        ),
    )

    error_code = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Safe application-level error code.",
    )

    error_message = models.TextField(
        blank=True,
        default="",
        help_text=(
            "Safe error message. Must not contain credentials, local paths, "
            "database errors, or tracebacks."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Set when the screening reaches COMPLETED or FAILED."
        ),
    )

    def __str__(self) -> str:
        return (
            f"PlagiarismScreening("
            f"{self.submission_version_id}, {self.status})"
        )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["status", "created_at"],
                name="integrity_status_created_idx",
            ),
            models.Index(
                fields=["submission_version", "-created_at"],
                name="integrity_version_created_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["submission_version"],
                condition=Q(
                    status__in=["QUEUED", "RUNNING"],
                ),
                name="unique_active_plagiarism_screening",
            ),
        ]