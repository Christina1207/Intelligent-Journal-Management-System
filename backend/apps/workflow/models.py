from django.utils import timezone
import uuid
from django.db import models
from django.conf import settings
from apps.accounts.models import Role
from .constants import TRIAGE_CHECKLIST_VERSION

class SubmissionAssignment(models.Model):
    class AssignmentReason(models.TextChoices):
        INITIAL = "INITIAL", "Initial assignment"
        WORKLOAD = "WORKLOAD", "Workload"
        CONFLICT = "CONFLICT", "Conflict of interest"
        INACTIVITY = "INACTIVITY", "Editor inactivity"
        UNAVAILABLE = "UNAVAILABLE", "Editor unavailable"
        ADMINISTRATIVE = "ADMINISTRATIVE", "Administrative correction"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    submission = models.ForeignKey(
        "submissions.Submission",
        on_delete=models.PROTECT,
        related_name="assignments",
    )

    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assignments_made",
        null=True,
        blank=True,
        # null: allows future system-generated assignments
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assignments_received",
    )
    assignment_reason = models.CharField(
        max_length=30,
        choices=AssignmentReason.choices,
        default=AssignmentReason.INITIAL,
    )

    role = models.CharField(
        max_length=50,
        choices=Role.RoleName.choices,
        # Snapshot of the role at assignment time.
        # Do not derive this from assigned_to.roles — that can change.
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.submission} → {self.assigned_to} "
            f"as {self.role} by {self.assigned_by}"
        )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Most common query pattern: all assignments for a submission
            models.Index(fields=["submission"], name="idx_assignment_submission"),
            # Second most common: all assignments received by a user
            models.Index(fields=["assigned_to"], name="idx_assignment_assigned_to"),
        ]

class ReviewerAssignment(models.Model):

    class Status(models.TextChoices):
        PENDING  = 'PENDING',  'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'
        EXPIRED  = 'EXPIRED',  'Expired'
        CANCELLED = "CANCELLED", "Cancelled"
        #OVERDUE  = 'OVERDUE',  'Overdue'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version  = models.ForeignKey(
                    'submissions.SubmissionVersion',
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments',
                  )
    reviewer    = models.ForeignKey(
        # TODO : should this be AUTH_USER_MODEL , unify that over the codebase
                    settings.AUTH_USER_MODEL,
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments',
                  )
    assigned_by = models.ForeignKey(
                    settings.AUTH_USER_MODEL,
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments_made',
                  )
    # why do we need this?
    # Audit trail: tracks which previous ReviewerAssignment this was
    # carried forward from on revision upload. Null on original assignments.
    # Enables full reviewer history tracing across revision rounds.
    carried_from = models.ForeignKey(  
                    'self',                   
                     on_delete=models.PROTECT,
                     related_name='carried_forward',
                     null=True,
                     blank=True,
                   )
    status          = models.CharField(
                        max_length=20,
                        choices=Status.choices,
                        default=Status.PENDING,
                      )
    response_deadline = models.DateTimeField()
    review_deadline   = models.DateTimeField()
    assigned_at       = models.DateTimeField(auto_now_add=True)
    review_reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "When the one-time review deadline reminder was "
            "successfully sent."
        ),
    )
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reviewer_assignments_cancelled",
        null=True,
        blank=True,
    )
    cancellation_reason = models.TextField(
        blank=True,
        default="",
    )
    replaces = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="replacement",
        null=True,
        blank=True,
        help_text=(
            "The cancelled reviewer assignment replaced by this invitation."
        ),
    )
    
    @property
    def is_overdue(self):
        return (
            self.status == self.Status.ACCEPTED
            and self.review_deadline < timezone.now()
            and not hasattr(self, "review")
        )
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['version', 'reviewer'],
                name='unique_reviewer_assignment_per_version',
            ),
        ]
        indexes = [
            # TODO :wtf are these indexed? someone check them
            # do we need an index for version ? we will often have no more than a couple versions
            models.Index(fields=['version','status']),
            models.Index(fields=["reviewer","status"]),
            models.Index(fields=['assigned_by']),
        ]

    def __str__(self):
        return f"ReviewerAssignment({self.reviewer_id} → {self.version_id} [{self.status}])"
    
class TriageAssessment(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        COMPLETED = "COMPLETED", "Completed"

    class Outcome(models.TextChoices):
        PROCEED = "PROCEED", "Proceed to editor assignment"
        DESK_REJECTED = "DESK_REJECTED", "Desk rejected"

    class RejectionReason(models.TextChoices):
        OUT_OF_SCOPE = "OUT_OF_SCOPE", "Outside journal or section scope"
        INCOMPLETE = "INCOMPLETE", "Incomplete submission"
        QUALITY = "QUALITY", "Insufficient submission quality"
        GUIDELINES = "GUIDELINES", "Submission guidelines not followed"
        ETHICS = "ETHICS", "Ethics or research-integrity concern"
        OTHER = "OTHER", "Other"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    submission_version = models.OneToOneField(
        "submissions.SubmissionVersion",
        on_delete=models.PROTECT,
        related_name="triage_assessment",
    )
    checklist_version = models.PositiveSmallIntegerField(
        default=TRIAGE_CHECKLIST_VERSION,
    )
    checks = models.JSONField(
        default=dict,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    outcome = models.CharField(
        max_length=30,
        choices=Outcome.choices,
        blank=True,
        default="",
    )
    internal_notes = models.TextField(blank=True, default="")
    rejection_reason = models.CharField(
        max_length=30,
        choices=RejectionReason.choices,
        blank=True,
        default="",
    )
    author_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="triage_assessments_created",
    )
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="triage_assessments_completed",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return (
            f"TriageAssessment("
            f"{self.submission_version_id} [{self.status}])"
        )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["status", "created_at"],
                name="idx_triage_status_created",
            ),
        ]