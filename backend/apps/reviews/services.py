from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from apps.accounts.models import Role, ReviewerProfile
from apps.submissions.models import Submission, SubmissionVersion
from apps.submissions.policies import (
    validate_revision_round_available,
)
from apps.workflow.models import ReviewerAssignment
from apps.reviews.models import Review
from config.constants import REQUIRED_REVIEWS_COUNT


class ReviewService:

    # ------------------------------------------------------------------ #
    #  ASSIGN REVIEWER                                                     #
    # ------------------------------------------------------------------ #
    #TODO: move this maybe to workflow or rename app later
    @staticmethod
    @transaction.atomic
    def assign_reviewer(*, editor, reviewer, submission, response_deadline, review_deadline):
        # TODO: fix bug here
        """
        Section Editor assigns a reviewer to a submission.
        Creates a ReviewerAssignment row.
        Transitions submission to UNDER_REVIEW if this is the first active assignment.
        """

        # --- permission checks ---
        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only a Section Editor can assign reviewers.")
        
        if submission.assigned_editor_id != editor.id:
            raise PermissionDenied("Only the section editor assigned to this submission can assign reviewers.")

        if not reviewer.has_role(Role.RoleName.REVIEWER):
            raise ValidationError("The target user does not have the Reviewer role.")

        is_approved_for_section = (
            ReviewerProfile.objects.filter(
                user=reviewer,
                sections=submission.section,
            )
            .exists()
        )

        if not is_approved_for_section:
            raise ValidationError(
                {
                    "reviewer_id": (
                        "This reviewer is not approved to review "
                        f"manuscripts in the '{submission.section}' "
                        "section."
                    )
                }
            )

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
        # Uniqueness enforced on current version only — append-only model
        # TODO: when reviewer carry-forward is active, also check previous versions
        # to avoid assigning a reviewer who was carried forward. Defer to Sprint 4.
        
        # Assign to the latest version of the submission
        current_version = submission.versions.order_by("-version_number").first()
        if current_version is None:
          raise ValidationError("Submission has no versions. Cannot assign reviewer.")


        already_invited_for_round = (
            ReviewerAssignment.objects.filter(
                version=current_version,
                reviewer=reviewer,
            ).exists()
        )

        if already_invited_for_round:
            raise ValidationError(
                {
                    "reviewer_id": (
                        "This reviewer has already been invited for "
                        "the current review round."
                    )
                }
            )

        has_active_assignment = (
            ReviewerAssignment.objects.filter(
                version__submission=submission,
                reviewer=reviewer,
                status__in=[
                    ReviewerAssignment.Status.PENDING,
                    ReviewerAssignment.Status.ACCEPTED,
                ],
            ).exists()
        )

        if has_active_assignment:
            raise ValidationError(
                {
                    "reviewer_id": (
                        "This reviewer already has an active assignment "
                        "for this submission."
                    )
                }
            )
        
        # --- deadline sanity ---
        now = timezone.now()

        if response_deadline <= now:
            raise ValidationError(
                {
                    "response_deadline": (
                        "Response deadline must be in the future."
                    )
                }
            )

        if review_deadline <= now:
            raise ValidationError(
                {
                    "review_deadline": (
                        "Review deadline must be in the future."
                    )
                }
            )

        if response_deadline >= review_deadline:
            raise ValidationError(
                {
                    "review_deadline": (
                        "Review deadline must be later than "
                        "the response deadline."
                    )
                }
            )
        # --- create assignment ---
        assignment = ReviewerAssignment.objects.create(
            version=current_version,
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

    

    @staticmethod
    @transaction.atomic
    def assign_reviewers(
        *,
        editor,
        reviewers,
        submission,
        response_deadline,
        review_deadline,
    ):
        """
        Invite multiple reviewers using shared deadlines.

        A separate ReviewerAssignment is created for every reviewer.
        The outer transaction guarantees all-or-nothing behavior.
        """

        if not reviewers:
            raise ValidationError(
                {
                    "reviewer_ids": (
                        "Select at least one reviewer."
                    )
                }
            )

        assignments = []

        for reviewer in reviewers:
            assignment = ReviewService.assign_reviewer(
                editor=editor,
                reviewer=reviewer,
                submission=submission,
                response_deadline=response_deadline,
                review_deadline=review_deadline,
            )
            assignments.append(assignment)

        return assignments


    # ------------------------------------------------------------------ #
    #  RESPOND TO ASSIGNMENT                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def respond_to_assignment(*, reviewer, assignment, accept: bool):
        """
        Reviewer accepts or declines an assignment invitation.
        Status is terminal once set.
        When enough reviewers accept, remaining pending invitations expire.
        """
        assignment = (
        ReviewerAssignment.objects
        .select_for_update()
        .select_related("version")
        .get(pk=assignment.pk)
        )   
        
        if assignment.reviewer_id!= reviewer.id:
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
        if accept:
            accepted_count = ReviewerAssignment.objects.filter(
                version=assignment.version,
                status=ReviewerAssignment.Status.ACCEPTED,
            ).count()

            if accepted_count >= REQUIRED_REVIEWS_COUNT:
                ReviewerAssignment.objects.filter(
                    version=assignment.version,
                    status=ReviewerAssignment.Status.PENDING,
                ).exclude(pk=assignment.pk).update(
                    status=ReviewerAssignment.Status.EXPIRED,
                )

        return assignment

    # ------------------------------------------------------------------ #
    #  SUBMIT REVIEW                                                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    @transaction.atomic
    def submit_review(*, reviewer, assignment, recommendation,comments_for_author,comments_for_editor="", ):
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
            .get(pk=assignment.version.submission_id)
        )

        # --- create the review ---
        review = Review.objects.create(
            assignment=assignment,
            recommendation=recommendation,
            comments_for_author=comments_for_author,
            comments_for_editor=comments_for_editor,
        )
        accepted_count = ReviewerAssignment.objects.filter(
            version=assignment.version,
            status=ReviewerAssignment.Status.ACCEPTED,
        ).count()

        # --- transition check ---
        submitted_count = ReviewerAssignment.objects.filter(
            version=assignment.version,
            status=ReviewerAssignment.Status.ACCEPTED,
            review__isnull=False,
        ).count()

        if accepted_count >= REQUIRED_REVIEWS_COUNT and submitted_count == accepted_count:
            submission.status = Submission.Status.REVIEWED
            submission.save(update_fields=["status"])

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
        
        submission = assignment.version.submission

        if submission.assigned_editor_id != editor.id:
            raise PermissionDenied("Only the section editor assigned to this submission can expire assignments.")

        if assignment.status != ReviewerAssignment.Status.PENDING:
            raise ValidationError(
                f"Cannot expire an assignment with status '{assignment.status}'. "
                "Only PENDING assignments can be expired."
            )

        assignment.status = ReviewerAssignment.Status.EXPIRED
        assignment.save(update_fields=['status'])

        return assignment

    # ------------------------------------------------------------------ #
    # MAKE EDITORIAL DECISION ON VERSION
    # ------------------------------------------------------------------ #
    @staticmethod
    @transaction.atomic
    def make_editor_decision(*, editor, submission, decision, decision_letter=""):
        """
        Assigned section editor records the decision for the latest reviewed version.

        ACCEPTED:
            submission becomes ACCEPTED and can move to publishing.
        REJECTED:
            submission becomes REJECTED and stops.
        MINOR_REVISION / MAJOR_REVISION:
            submission becomes UNDER_REVISION and waits for author revision upload.
        """

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied("Only a Section Editor can make editorial decisions.")

        submission = (
            Submission.objects
            .select_for_update(of=("self",))
            .select_related("assigned_editor")
            .get(pk=submission.pk)
        )

        if submission.assigned_editor_id != editor.id:
            raise PermissionDenied(
                "Only the assigned section editor can decide this submission."
            )

        if submission.status != Submission.Status.REVIEWED:
            raise ValidationError(
                f"Cannot make a decision while submission status is '{submission.status}'. "
                "The submission must be REVIEWED first."
            )

        current_version = (
            submission.versions
            .select_for_update()
            .order_by("-version_number")
            .first()
        )

        if current_version is None:
            raise ValidationError("Submission has no versions to decide.")

        if current_version.decision != SubmissionVersion.Decision.PENDING:
            raise ValidationError("A decision has already been made for this version.")

        if decision == SubmissionVersion.Decision.PENDING:
            raise ValidationError("PENDING is not a valid editor decision.")
        revision_decisions = {
            SubmissionVersion.Decision.MINOR_REVISION,
            SubmissionVersion.Decision.MAJOR_REVISION,
        }

        if decision in revision_decisions:
            validate_revision_round_available(submission)

        accepted_count = ReviewerAssignment.objects.filter(
            version=current_version,
            status=ReviewerAssignment.Status.ACCEPTED,
        ).count()

        submitted_count = ReviewerAssignment.objects.filter(
            version=current_version,
            status=ReviewerAssignment.Status.ACCEPTED,
            review__isnull=False,
        ).count()

        if accepted_count < REQUIRED_REVIEWS_COUNT:
            raise ValidationError(
                f"Cannot decide with only {accepted_count} accepted reviewers. "
                f"At least {REQUIRED_REVIEWS_COUNT} are required."
            )

        if submitted_count != accepted_count:
            raise ValidationError(
                "Cannot decide until all accepted reviewers have submitted their reviews."
            )

        current_version.decision = decision
        current_version.decided_by = editor
        current_version.decided_at = timezone.now()

        # Only if you add decision_letter to the model
        current_version.decision_letter = decision_letter

        current_version.save(
            update_fields=[
                "decision",
                "decided_by",
                "decided_at",
                "decision_letter",
            ]
        )

        if decision == SubmissionVersion.Decision.ACCEPTED:
            submission.status = Submission.Status.ACCEPTED
        elif decision == SubmissionVersion.Decision.REJECTED:
            submission.status = Submission.Status.REJECTED
        elif decision in (
            SubmissionVersion.Decision.MINOR_REVISION,
            SubmissionVersion.Decision.MAJOR_REVISION,
        ):
            submission.status = Submission.Status.UNDER_REVISION
        else:
            raise ValidationError(f"Unsupported decision '{decision}'.")

        submission.save(update_fields=["status"])

        return current_version

    @staticmethod
    @transaction.atomic
    def cancel_assignment(
        *,
        editor,
        assignment,
        reason,
    ):
        assignment = (
            ReviewerAssignment.objects
            .select_for_update(of=("self",))
            .select_related(
                "reviewer",
                "version",
                "version__submission",
                "version__submission__assigned_editor",
            )
            .get(pk=assignment.pk)
        )

        submission = (
            Submission.objects
            .select_for_update()
            .get(pk=assignment.version.submission_id)
        )

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise PermissionDenied(
                "Only a Section Editor can cancel reviewer assignments."
            )

        if submission.assigned_editor_id != editor.id:
            raise PermissionDenied(
                "Only the assigned Section Editor can cancel "
                "reviewer assignments for this submission."
            )

        latest_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        if (
            latest_version is None
            or assignment.version_id != latest_version.id
        ):
            raise ValidationError(
                "Only assignments from the current review round "
                "can be cancelled."
            )

        if assignment.status not in {
            ReviewerAssignment.Status.PENDING,
            ReviewerAssignment.Status.ACCEPTED,
        }:
            raise ValidationError(
                {
                    "assignment": (
                        "Only pending or accepted reviewer assignments "
                        "can be cancelled."
                    )
                }
            )

        if hasattr(assignment, "review"):
            raise ValidationError(
                {
                    "assignment": (
                        "A reviewer assignment cannot be cancelled "
                        "after its review has been submitted."
                    )
                }
            )

        assignment.status = ReviewerAssignment.Status.CANCELLED
        assignment.cancelled_at = timezone.now()
        assignment.cancelled_by = editor
        assignment.cancellation_reason = reason
        assignment.save(
            update_fields=[
                "status",
                "cancelled_at",
                "cancelled_by",
                "cancellation_reason",
            ]
        )

        return assignment


    @staticmethod
    @transaction.atomic
    def replace_assignment(
        *,
        editor,
        assignment,
        replacement_reviewer,
        response_deadline,
        review_deadline,
        reason,
    ):
        if assignment.reviewer_id == replacement_reviewer.id:
            raise ValidationError(
                {
                    "reviewer_id": (
                        "Select a different reviewer as the replacement."
                    )
                }
            )

        cancelled_assignment = ReviewService.cancel_assignment(
            editor=editor,
            assignment=assignment,
            reason=reason,
        )

        submission = cancelled_assignment.version.submission

        replacement_assignment = ReviewService.assign_reviewer(
            editor=editor,
            reviewer=replacement_reviewer,
            submission=submission,
            response_deadline=response_deadline,
            review_deadline=review_deadline,
        )

        replacement_assignment.replaces = cancelled_assignment
        replacement_assignment.save(update_fields=["replaces"])

        return cancelled_assignment, replacement_assignment    
