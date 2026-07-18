import uuid
from django.db import models
from django.conf import settings
from pgvector.django import VectorField

# ISO 639-1 language codes
# Format: ("code", "Display Name") — e.g. ("en", "English")
LANGUAGE_CHOICES = [
    ("en", "English"),
    ("ar", "Arabic"),
    ("fr", "French"),
]


class Submission(models.Model):
    class Status(models.TextChoices):
        SUBMITTED     = "SUBMITTED",     "Submitted"
        ASSIGNED      = "ASSIGNED",      "Assigned"
        UNDER_REVIEW  = "UNDER_REVIEW",  "Under Review"
        SUSPENDED     = "SUSPENDED",     "Suspended"
        REVIEWED      = "REVIEWED",      "Reviewed"
        UNDER_REVISION = "UNDER_REVISION", "Under Revision"
        REVISED       = "REVISED",       "Revised"
        ACCEPTED      = "ACCEPTED",      "Accepted"
        REJECTED      = "REJECTED",      "Rejected"
    # TODO: should i add PUBLISHED?

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500)
    abstract = models.TextField()
    keywords = models.JSONField(
        default=list,
        blank=True,
        help_text="Author-supplied scholarly keywords.",
    )
    language = models.CharField(
        max_length=10,
        choices=LANGUAGE_CHOICES,
    )
    cover_letter = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SUBMITTED,
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    # FK to settings.AUTH_USER_MODEL, never reference User directly
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submissions",
        # TODO Sprint N: soft delete mechanism — add is_deleted to User
        # and override default manager before relaxing PROTECT here
    )

    section = models.ForeignKey(
        "journals.Section",
        on_delete=models.PROTECT,
        related_name="submissions",
        # PROTECT: deactivating a section ≠ deleting its submissions
        # suspension logic handled at the view/service layer, not DB cascade
    )
    # Use SubmissionAssignment as audit/history
    # Use Submission.assigned_editor as current active editor
    assigned_editor  = models.ForeignKey(      
                         settings.AUTH_USER_MODEL,
                         on_delete=models.PROTECT,
                         related_name='assigned_submissions',
                         null=True,
                         blank=True,
                         help_text="Current responsible section editor. Historical assignments are stored in SubmissionAssignment.",
                       )
    abstract_embedding = VectorField(       
                           dimensions=384,
                           null=True,
                           blank=True,
                         )

    def __str__(self):
        return f"{self.title} [{self.status}]"

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['author']),
            models.Index(fields=['assigned_editor']),
        ]

class SubmissionCoAuthor(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="coauthors",
    )
    full_name = models.CharField(max_length=255)
    email = models.EmailField()
    orcid = models.CharField(max_length=19, blank=True, default="")
    affiliation = models.CharField(max_length=255, blank=True, default="")
    country = models.CharField(max_length=100, blank=True, default="")
    order = models.PositiveSmallIntegerField()

    def __str__(self):
        return f"{self.full_name} — {self.submission.title}"

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["submission", "order"],
                name="unique_submission_coauthor_order",
            ),
        ]

class SubmissionVersion(models.Model):

    class Decision(models.TextChoices):
        PENDING        = 'PENDING',        'Pending'
        ACCEPTED       = 'ACCEPTED',       'Accepted'
        REJECTED       = 'REJECTED',       'Rejected'
        MAJOR_REVISION = 'MAJOR_REVISION', 'Major Revision'
        MINOR_REVISION = 'MINOR_REVISION', 'Minor Revision'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission     = models.ForeignKey(
                       Submission,
                       on_delete=models.PROTECT,
                       related_name='versions',
                     )
    version_number = models.PositiveIntegerField()
    file = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="Private MinIO object path for the full manuscript.",
    )

    blinded_file = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="Private MinIO object path for the anonymized manuscript.",
    )
    submitted_at   = models.DateTimeField(auto_now_add=True)
    decision       = models.CharField(
                       max_length=20,
                       choices=Decision.choices,
                       default=Decision.PENDING,
                     )
    decided_at     = models.DateTimeField(null=True, blank=True)
    decided_by     = models.ForeignKey(
                       settings.AUTH_USER_MODEL,
                       on_delete=models.PROTECT,
                       related_name='version_decisions',
                       null=True,
                       blank=True,
                     )
    decision_letter = models.TextField(blank=True)
    response_to_reviewers = models.TextField(blank=True, default="")

    class Meta:
        unique_together = [('submission', 'version_number')]
        indexes = [
            models.Index(fields=['submission']),
        ]

    def __str__(self):
        return f"SubmissionVersion({self.submission_id} v{self.version_number} [{self.decision}])"
    
class SubmissionTopic(models.Model):
    """
    Stores BERTopic clustering output for a submission.
    One row per submission, created/overwritten on each section re-cluster.
    label=None and keywords=[] indicates an outlier (BERTopic topic -1)
    or a submission processed but not assigned to any meaningful cluster.

    Lives in submissions, not journals, to preserve dependency direction —
    submissions already depends on journals, not the reverse.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.OneToOneField(
        Submission,
        on_delete=models.PROTECT,
        related_name="topic",
    )
    label = models.CharField(max_length=255, null=True, blank=True)
    keywords = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SubmissionTopic({self.submission_id}: {self.label or 'outlier'})"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["submission"]),
        ]