from django.db import transaction

from apps.accounts.models import Role, User
from apps.submissions.models import Submission
from .models import SubmissionAssignment


class AssignmentService:

    '''
        @transaction.atomic is critical here.
        Two writes happen: create SubmissionAssignment + update Submission.status.
        If the second write fails, the first must roll back. 
        Without atomic, you'd have an assignment record pointing at a submission that still shows SUBMITTED
    '''
    @staticmethod
    @transaction.atomic
    def assign_editor(
        submission: Submission,
        editor: User,
        assigned_by: User,
    ) -> SubmissionAssignment:
        """
        Assign a Section Editor to a submission.

        Business rules enforced here:
        - Submission must be in SUBMITTED status
        - Editor must have SECTION_EDITOR role
        - Creates SubmissionAssignment record
        - Transitions submission status to ASSIGNED
        """
        if submission.status != Submission.Status.SUBMITTED:
            raise ValueError(
                f"Submission is not in SUBMITTED status. "
                f"Current status: {submission.status}"
            )

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValueError(
                f"User {editor.username} does not have the SECTION_EDITOR role."
            )

        assignment = SubmissionAssignment.objects.create(
            submission=submission,
            assigned_to=editor,
            assigned_by=assigned_by,
            role=Role.RoleName.SECTION_EDITOR,
        )
        submission.assigned_editor = editor
        submission.status = Submission.Status.ASSIGNED
        submission.save(update_fields=["assigned_editor", "status"])

        return assignment