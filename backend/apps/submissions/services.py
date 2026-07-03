import logging
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.workflow.models import ReviewerAssignment
from apps.core.storage import StorageService
from config.constants import MAX_REVISION_ROUNDS
from .models import Submission, SubmissionVersion

logger = logging.getLogger(__name__)


class SubmissionService:

    @staticmethod
    @transaction.atomic
    def create_submission(author, validated_data: dict, file) -> Submission:
        # TODO check author has AUTHOR role here or in the view?
        # TODO check how the author is passed(token)
        """
        Create a new submission with v1 atomically.
        - Uploads PDF to MinIO
        - Creates Submission record
        - Creates SubmissionVersion(v1)
        - Dispatches embedding Celery task after commit

        File upload happens before DB writes — if upload fails,
        no DB records are created. If DB write fails after upload,
        the orphaned MinIO object is acceptable (storage is cheap,
        correctness is not).

        # TODO Phase 7: implement MinIO cleanup on DB failure via
        # post-transaction hook or a periodic orphan cleanup task.
        """
        submission = Submission.objects.create(
            author=author,
            status=Submission.Status.SUBMITTED,
            **validated_data,
        )

        # Upload PDF to MinIO
        storage = StorageService()
        object_name = storage.upload(
            file_obj=file,
            submission_id=str(submission.id),
            version_number=1,
            filename=file.name,
        )

        # Create v1 atomically with submission
        SubmissionVersion.objects.create(
            submission=submission,
            version_number=1,
            file=object_name,
        )

        # Dispatch embedding task after transaction commits
        # Import here to avoid circular imports
        from .tasks import generate_submission_embedding
        transaction.on_commit(
            lambda: generate_submission_embedding.delay(str(submission.id))
        )

        logger.info(
            "Submission %s created with v1. Embedding task dispatched.",
            submission.id,
        )

        return submission

    @staticmethod
    @transaction.atomic
    def create_revision(author, submission: Submission, file, review_deadline) -> SubmissionVersion:
        """
        Upload a new revision for a submission.
        Business rules:
        - Author must own the submission
        - Submission must be UNDER_REVISION
        - Latest version decision must be MINOR_REVISION or MAJOR_REVISION.
        - MAX_REVISION_ROUNDS enforced
        - ACCEPTED reviewers from previous version carried forward
        - carried_from FK set on new ReviewerAssignment rows
         - New carried-forward assignments are ACCEPTED immediately.
        - Submission status transitions to UNDER_REVIEW.
        """
        submission = (
            Submission.objects
            .select_for_update()
            .get(pk=submission.pk)
        )
        if submission.author_id != author.id:
            raise ValidationError("Only the submission author can upload a revision.")

        if submission.status != Submission.Status.UNDER_REVISION:
            raise ValidationError(
                f"Submission is not under revision. "
                f"Current status: {submission.status}"
            )

        previous_version = (
            submission.versions
            .select_for_update()
            .order_by("-version_number")
            .first()
        )

        if previous_version is None:
            raise ValidationError("No previous version found for this submission.")
        
        if previous_version.decision not in [
            SubmissionVersion.Decision.MAJOR_REVISION,
            SubmissionVersion.Decision.MINOR_REVISION,
        ]:
            raise ValidationError(
                f"Previous version decision must be MAJOR_REVISION or MINOR_REVISION. "
                f"Current decision: {previous_version.decision}"
            )
        current_version_count = submission.versions.count()
        
        # TODO: i think this check doesn't belong here , it belongs in the decision
        if current_version_count >= MAX_REVISION_ROUNDS:
            raise ValidationError(
                f"Maximum revision rounds ({MAX_REVISION_ROUNDS}) reached. "
                "No further revisions are allowed."
            )
        
        #TODO: i don't think this check belongs here , but i don't know where it belongs
        if review_deadline <= timezone.now():
            raise ValidationError("Review deadline must be in the future.")
        
        accepted_assignments = list(
            ReviewerAssignment.objects
            .select_for_update()
            .filter(
                version=previous_version,
                status=ReviewerAssignment.Status.ACCEPTED,
            )
            .select_related("reviewer")
        )
        if not accepted_assignments:
            raise ValidationError(
                "Cannot create revision because there are no accepted reviewers to carry forward."
            )
        
        new_version_number = previous_version.version_number + 1

        storage = StorageService()
        object_name = storage.upload(
            file_obj=file,
            submission_id=str(submission.id),
            version_number=new_version_number,
            filename=file.name,
        )

        new_version = SubmissionVersion.objects.create(
            submission=submission,
            version_number=new_version_number,
            file=object_name,
        )

        response_deadline = timezone.localdate()
        for assignment in accepted_assignments:
                ReviewerAssignment.objects.create(
                    version=new_version,
                    reviewer=assignment.reviewer,
                    assigned_by=submission.assigned_editor or assignment.assigned_by,
                    carried_from=assignment,
                    status=ReviewerAssignment.Status.ACCEPTED,
                    response_deadline=response_deadline,
                    review_deadline=review_deadline,
                )
        submission.status = Submission.Status.UNDER_REVIEW
        submission.save(update_fields=["status"])

        logger.info(
            "Revision v%d created for submission %s. "
            "%d reviewers carried forward.",
            new_version_number,
            submission.id,
            accepted_assignments.count(),
        )
        return new_version