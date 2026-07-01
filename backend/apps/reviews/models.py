import uuid
from django.db import models


class Review(models.Model):

    class Recommendation(models.TextChoices):
        ACCEPT         = 'ACCEPT',         'Accept'
        MINOR_REVISION = 'MINOR_REVISION', 'Minor Revision'
        MAJOR_REVISION = 'MAJOR_REVISION', 'Major Revision'
        REJECT         = 'REJECT',         'Reject'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.OneToOneField(
                   'workflow.ReviewerAssignment',
                   on_delete=models.PROTECT,
                   related_name='review',
                 )
    recommendation = models.CharField(max_length=20, choices=Recommendation.choices)
    comments_for_author = models.TextField()
    comments_for_editor = models.TextField(blank=True)
    submitted_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Review({self.assignment.reviewer_id} → {self.assignment.submission_id} [{self.recommendation}])"
    class Meta:
        indexes = [
            models.Index(fields=["recommendation"]),
            models.Index(fields=["submitted_at"]),
        ]