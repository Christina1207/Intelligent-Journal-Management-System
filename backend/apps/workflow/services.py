from django.db import transaction
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role, User
from apps.journals.models import SectionEditorMembership
from apps.submissions.models import Submission

from .models import SubmissionAssignment

class AssignmentService:
    @staticmethod
    @transaction.atomic
    def assign_editor(
        *,
        submission: Submission,
        editor: User,
        assigned_by: User,
    ) -> SubmissionAssignment:
        """
        Assign an eligible Section Editor to a submitted manuscript.

        The submission row is locked because assignment changes both the
        assignment history and the submission's current responsible editor.
        """
        submission = (
            Submission.objects.select_for_update()
            .select_related("section", "author", "assigned_editor")
            .get(pk=submission.pk)
        )

        if not assigned_by.has_role(Role.RoleName.SECTION_MANAGER):
            raise PermissionDenied(
                "Only a Section Manager can assign a Section Editor."
            )

        if submission.section.manager_id != assigned_by.id:
            raise PermissionDenied(
                "You do not manage the section containing this submission."
            )

        if submission.status != Submission.Status.SUBMITTED:
            raise ValidationError(
                {
                    "submission": (
                        "Only submissions in SUBMITTED status can receive "
                        "an initial Section Editor assignment."
                    )
                }
            )

        if submission.assigned_editor_id is not None:
            raise ValidationError(
                {
                    "submission": (
                        "This submission already has a Section Editor."
                    )
                }
            )

        if not editor.has_role(Role.RoleName.SECTION_EDITOR):
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected user does not have the "
                        "SECTION_EDITOR role."
                    )
                }
            )

        if editor.status != User.Status.ACTIVE:
            raise ValidationError(
                {
                    "editor_id": (
                        "An inactive Section Editor cannot receive "
                        "new assignments."
                    )
                }
            )

        if editor.id == submission.author_id:
            raise ValidationError(
                {
                    "editor_id": (
                        "The manuscript author cannot be assigned as its "
                        "Section Editor."
                    )
                }
            )

        is_eligible_for_section = (
            SectionEditorMembership.objects.filter(
                section=submission.section,
                editor=editor,
                is_active=True,
            ).exists()
        )

        if not is_eligible_for_section:
            raise ValidationError(
                {
                    "editor_id": (
                        "The selected Section Editor is not an active "
                        "member of this submission's section."
                    )
                }
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