import uuid
from django.db import models
from django.conf import settings
from apps.accounts.models import Role


class SubmissionAssignment(models.Model):
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
        OVERDUE  = 'OVERDUE',  'Overdue'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission  = models.ForeignKey(
                    'submissions.Submission',
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments',
                  )
    reviewer    = models.ForeignKey(
                    'accounts.User',
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments',
                  )
    assigned_by = models.ForeignKey(
                    'accounts.User',
                    on_delete=models.PROTECT,
                    related_name='reviewer_assignments_made',
                  )
    status          = models.CharField(
                        max_length=20,
                        choices=Status.choices,
                        default=Status.PENDING,
                      )
    response_deadline = models.DateField()
    review_deadline   = models.DateField()
    assigned_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['submission']),
            models.Index(fields=['reviewer']),
        ]

    def __str__(self):
        return f"ReviewerAssignment({self.reviewer_id} → {self.submission_id} [{self.status}])"