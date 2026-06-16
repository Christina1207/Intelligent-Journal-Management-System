import logging
from django.db import transaction
from django.core.exceptions import ValidationError

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
    def create_revision(author, submission: Submission, file) -> SubmissionVersion:
        """
        Upload a new revision for a submission.
        Business rules:
        - Author must own the submission
        - Submission must be UNDER_REVISION
        - MAX_REVISION_ROUNDS enforced
        - ACCEPTED reviewers from previous version carried forward
        - carried_from FK set on new ReviewerAssignment rows
        - Submission status transitions to REVISED
        """
        if submission.author_id != author.id:
            raise ValidationError("Only the submission author can upload a revision.")

        if submission.status != Submission.Status.UNDER_REVISION:
            raise ValidationError(
                f"Submission is not under revision. "
                f"Current status: {submission.status}"
            )

        current_version_number = submission.versions.count()

        if current_version_number >= MAX_REVISION_ROUNDS:
            raise ValidationError(
                f"Maximum revision rounds ({MAX_REVISION_ROUNDS}) reached. "
                "No further revisions are allowed."
            )

        new_version_number = current_version_number + 1

        # Upload new PDF to MinIO
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

        # Carry forward ACCEPTED reviewers from the previous version
        from apps.workflow.models import ReviewerAssignment

        previous_version = submission.versions.get(
            version_number=current_version_number
        )
        accepted_assignments = ReviewerAssignment.objects.filter(
            version=previous_version,
            status=ReviewerAssignment.Status.ACCEPTED,
        ).select_related("reviewer")

        for assignment in accepted_assignments:
            ReviewerAssignment.objects.create(
                version=new_version,
                reviewer=assignment.reviewer,
                assigned_by=assignment.assigned_by,
                carried_from=assignment,
                status=ReviewerAssignment.Status.ACCEPTED,
                response_deadline=assignment.response_deadline,
                review_deadline=assignment.review_deadline,
            )

        logger.info(
            "Revision v%d created for submission %s. "
            "%d reviewers carried forward.",
            new_version_number,
            submission.id,
            accepted_assignments.count(),
        )

        submission.status = Submission.Status.REVISED
        submission.save(update_fields=["status"])

        return new_version

    @staticmethod
    @transaction.atomic
    def decide_version(
        editor,
        version: SubmissionVersion,
        decision: str,
    ) -> SubmissionVersion:
        """
        Section editor sets a decision on a SubmissionVersion.
        Status transitions:
        - MAJOR_REVISION / MINOR_REVISION → submission UNDER_REVISION
        - ACCEPTED → submission ACCEPTED
        - REJECTED → submission REJECTED

        MAX_REVISION_ROUNDS enforced on revision decisions —
        editor cannot set MAJOR/MINOR_REVISION if rounds exhausted.
        """
        from django.utils import timezone
        from apps.accounts.models import Role

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValidationError("Only section editors can set version decisions.")

        if version.decision != SubmissionVersion.Decision.PENDING:
            raise ValidationError("A decision has already been set for this version.")

        submission = version.submission

        revision_decisions = {
            SubmissionVersion.Decision.MAJOR_REVISION,
            SubmissionVersion.Decision.MINOR_REVISION,
        }

        if decision in revision_decisions:
            current_version_count = submission.versions.count()
            if current_version_count >= MAX_REVISION_ROUNDS:
                raise ValidationError(
                    f"Maximum revision rounds ({MAX_REVISION_ROUNDS}) reached. "
                    "Cannot request further revisions."
                )
            submission.status = Submission.Status.UNDER_REVISION

        elif decision == SubmissionVersion.Decision.ACCEPTED:
            submission.status = Submission.Status.ACCEPTED
            # TODO Sprint 4: trigger DOI assignment and publishing workflow here

        elif decision == SubmissionVersion.Decision.REJECTED:
            submission.status = Submission.Status.REJECTED
            # TODO Sprint 4: trigger author notification here

        else:
            raise ValidationError(f"Invalid decision: {decision}")

        version.decision = decision
        version.decided_at = timezone.now()
        version.decided_by = editor
        version.save(update_fields=["decision", "decided_at", "decided_by"])

        submission.save(update_fields=["status"])

        logger.info(
            "Version %s of submission %s decided: %s by editor %s.",
            version.id, submission.id, decision, editor.id,
        )

        return version