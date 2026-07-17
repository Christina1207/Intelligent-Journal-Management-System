import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.workflow.models import ReviewerAssignment
from apps.core.storage import StorageService
from config.constants import  REVISION_REVIEW_DEADLINE_DAYS
from .models import Submission, SubmissionVersion
from .policies import validate_revision_round_available

logger = logging.getLogger(__name__)


class AuthorDashboardService:
    ACTIVE_STATUSES = (
        Submission.Status.SUBMITTED,
        Submission.Status.ASSIGNED,
        Submission.Status.UNDER_REVIEW,
        Submission.Status.REVIEWED,
        Submission.Status.REVISED,
    )
    ACTION_REQUIRED_STATUSES = (
        Submission.Status.UNDER_REVISION,
    )
    RECENT_SUBMISSIONS_LIMIT = 5

    @classmethod
    def get_dashboard(cls, author):
        submissions = Submission.objects.filter(author=author)

        summary = submissions.aggregate(
            total=Count("id"),
            active=Count(
                "id",
                filter=Q(status__in=cls.ACTIVE_STATUSES),
            ),
            needs_revision=Count(
                "id",
                filter=Q(status=Submission.Status.UNDER_REVISION),
            ),
            accepted=Count(
                "id",
                filter=Q(status=Submission.Status.ACCEPTED),
            ),
            rejected=Count(
                "id",
                filter=Q(status=Submission.Status.REJECTED),
            ),
        )

        action_required = (
            submissions
            .filter(status__in=cls.ACTION_REQUIRED_STATUSES)
            .select_related("section")
            .order_by("-submitted_at")
        )
        recent_submissions = (
            submissions
            .select_related("section")
            .order_by("-submitted_at")[:cls.RECENT_SUBMISSIONS_LIMIT]
        )

        return {
            "summary": summary,
            "action_required": action_required,
            "recent_submissions": recent_submissions,
        }


class SubmissionService:

    @staticmethod
    @transaction.atomic
    def create_submission(author, validated_data: dict, file, blinded_file) -> Submission:
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
        uploaded_objects = []

        try:
            full_object_name = storage.upload(
                file_obj=file,
                submission_id=str(submission.id),
                version_number=1,
                filename=file.name,
                variant="full",
            )
            uploaded_objects.append(full_object_name)

            blinded_object_name = storage.upload(
                file_obj=blinded_file,
                submission_id=str(submission.id),
                version_number=1,
                filename=blinded_file.name,
                variant="blinded",
            )
            uploaded_objects.append(blinded_object_name)

            SubmissionVersion.objects.create(
                submission=submission,
                version_number=1,
                file=full_object_name,
                blinded_file=blinded_object_name,
            )
        except Exception:
            for object_name in uploaded_objects:
                try:
                    storage.delete(object_name)
                except Exception:
                    logger.exception(
                        "Failed to clean up manuscript object %s.",
                        object_name,
                    )
            raise

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
    def create_revision(
        author,
        submission: Submission,
        file,
        blinded_file,
        response_to_reviewers: str = "",
    ) -> SubmissionVersion:
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
        - Review deadline is determined by backend policy.
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
        
        validate_revision_round_available(submission)

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
        uploaded_objects = []

        try:
            full_object_name = storage.upload(
                file_obj=file,
                submission_id=str(submission.id),
                version_number=new_version_number,
                filename=file.name,
                variant="full",
            )
            uploaded_objects.append(full_object_name)

            blinded_object_name = storage.upload(
                file_obj=blinded_file,
                submission_id=str(submission.id),
                version_number=new_version_number,
                filename=blinded_file.name,
                variant="blinded",
            )
            uploaded_objects.append(blinded_object_name)

            new_version = SubmissionVersion.objects.create(
                submission=submission,
                version_number=new_version_number,
                file=full_object_name,
                blinded_file=blinded_object_name,
                response_to_reviewers=response_to_reviewers or "",
            )

            response_deadline = timezone.now()
            review_deadline = response_deadline + timedelta(
                days=REVISION_REVIEW_DEADLINE_DAYS,
            )
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
                len(accepted_assignments),
            )
            return new_version
        except Exception:
            for object_name in uploaded_objects:
                try:
                    storage.delete(object_name)
                except Exception:
                    logger.exception(
                        "Failed to clean up manuscript object %s.",
                        object_name,
                    )
            raise
        
