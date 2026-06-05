from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied

from apps.accounts.models import Role
from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment
from apps.reviews.models import Review
from config.constants import REQUIRED_REVIEWS_COUNT


class ReviewService:

    # ------------------------------------------------------------------ #
    #  ASSIGN REVIEWER                                                     #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def assign_reviewer(*, editor, reviewer, submission, response_deadline, review_deadline):
        """
        Section Editor assigns a reviewer to a submission.
        Creates a ReviewerAssignment row.
        Transitions submission to UNDER_REVIEW if this is the first active assignment.
        """

        # --- permission checks ---
        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only a Section Editor can assign reviewers.")

        if not reviewer.has_role(Role.RoleName.REVIEWER):
            raise ValidationError("The target user does not have the Reviewer role.")

        # --- domain checks ---
        if reviewer == submission.author:
            raise ValidationError("A reviewer cannot review their own submission.")

        if submission.status not in (
            Submission.Status.ASSIGNED,
            Submission.Status.UNDER_REVIEW,
        ):
            raise ValidationError(
                f"Cannot assign reviewers to a submission with status '{submission.status}'."
            )

        active_exists = ReviewerAssignment.objects.filter(
            submission=submission,
            reviewer=reviewer,
            status__in=[
                ReviewerAssignment.Status.PENDING,
                ReviewerAssignment.Status.ACCEPTED,
            ],
        ).exists()

        if active_exists:
            raise ValidationError(
                "This reviewer already has an active assignment for this submission."
            )

        # --- deadline sanity ---
        if response_deadline >= review_deadline:
            raise ValidationError(
                "Response deadline must be earlier than the review deadline."
            )

        # --- create assignment ---
        assignment = ReviewerAssignment.objects.create(
            submission=submission,
            reviewer=reviewer,
            assigned_by=editor,
            status=ReviewerAssignment.Status.PENDING,
            response_deadline=response_deadline,
            review_deadline=review_deadline,
        )

        # --- transition submission to UNDER_REVIEW on first active assignment ---
        if submission.status == Submission.Status.ASSIGNED:
            submission.status = Submission.Status.UNDER_REVIEW
            submission.save(update_fields=['status'])

        return assignment

    # ------------------------------------------------------------------ #
    #  RESPOND TO ASSIGNMENT                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def respond_to_assignment(*, reviewer, assignment, accept: bool):
        """
        Reviewer accepts or declines an assignment invitation.
        Status is terminal once set — cannot be changed after this call.
        """

        if assignment.reviewer != reviewer:
            raise PermissionDenied("You are not the reviewer on this assignment.")

        if assignment.status != ReviewerAssignment.Status.PENDING:
            raise ValidationError(
                f"Cannot respond to an assignment with status '{assignment.status}'. "
                "Only PENDING assignments can be accepted or declined."
            )

        assignment.status = (
            ReviewerAssignment.Status.ACCEPTED
            if accept
            else ReviewerAssignment.Status.DECLINED
        )
        assignment.save(update_fields=['status'])

        return assignment

    # ------------------------------------------------------------------ #
    #  SUBMIT REVIEW                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def submit_review(*, reviewer, assignment, recommendation, content):
        """
        Reviewer submits their evaluation.
        Uses select_for_update() on Submission to prevent race condition
        on the REVIEWED transition check.
        """

        if assignment.reviewer != reviewer:
            raise PermissionDenied("You are not the reviewer on this assignment.")

        if assignment.status != ReviewerAssignment.Status.ACCEPTED:
            raise ValidationError(
                f"Cannot submit a review for an assignment with status '{assignment.status}'. "
                "Assignment must be ACCEPTED."
            )

        if hasattr(assignment, 'review'):
            raise ValidationError("A review has already been submitted for this assignment.")

        if recommendation not in Review.Recommendation.values:
            raise ValidationError(f"Invalid recommendation '{recommendation}'.")

        # --- lock submission row to prevent race condition ---
        submission = (
            Submission.objects
            .select_for_update()
            .get(pk=assignment.submission_id)
        )

        # --- create the review ---
        review = Review.objects.create(
            assignment=assignment,
            recommendation=recommendation,
            content=content,
        )

        # --- transition check ---
        submitted_count = ReviewerAssignment.objects.filter(
            submission=submission,
            status=ReviewerAssignment.Status.ACCEPTED,
            review__isnull=False,
        ).count()

        if submitted_count >= REQUIRED_REVIEWS_COUNT:
            submission.status = Submission.Status.REVIEWED
            submission.save(update_fields=['status'])

        return review

    # ------------------------------------------------------------------ #
    #  MARK ASSIGNMENT EXPIRED                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def mark_assignment_expired(*, editor, assignment):
        """
        Section Editor manually marks a PENDING assignment as EXPIRED.
        Used when reviewer has not responded by response_deadline.
        Celery will automate this in a future sprint.
        """

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only a Section Editor can expire assignments.")

        if assignment.status != ReviewerAssignment.Status.PENDING:
            raise ValidationError(
                f"Cannot expire an assignment with status '{assignment.status}'. "
                "Only PENDING assignments can be expired."
            )

        assignment.status = ReviewerAssignment.Status.EXPIRED
        assignment.save(update_fields=['status'])

        return assignment

    # ------------------------------------------------------------------ #
    #  MARK ASSIGNMENT OVERDUE                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def mark_assignment_overdue(*, editor, assignment):
        """
        Section Editor manually marks an ACCEPTED assignment as OVERDUE.
        Used when reviewer has not submitted by review_deadline.
        Celery will automate this in a future sprint.
        """

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only a Section Editor can mark assignments as overdue.")

        if assignment.status != ReviewerAssignment.Status.ACCEPTED:
            raise ValidationError(
                f"Cannot mark an assignment as overdue with status '{assignment.status}'. "
                "Only ACCEPTED assignments can be marked overdue."
            )

        assignment.status = ReviewerAssignment.Status.OVERDUE
        assignment.save(update_fields=['status'])

        return assignment