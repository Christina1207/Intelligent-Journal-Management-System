from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role
from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment


def require_section_editor(user):
    if not user.has_role(Role.RoleName.SECTION_EDITOR):
        raise PermissionDenied(
            "Only Section Editors can perform this action."
        )


def assigned_editor_submission_or_404(
    *,
    editor,
    submission_id,
):
    """
    Return a submission only when the authenticated Section Editor is
    its current assigned editor.

    Unrelated submissions return 404 to avoid exposing their existence.
    """
    require_section_editor(editor)

    return get_object_or_404(
        Submission.objects.select_related(
            "author",
            "section",
            "assigned_editor",
        ),
        pk=submission_id,
        assigned_editor=editor,
    )


def assigned_editor_reviewer_assignment_or_404(
    *,
    editor,
    assignment_id,
):
    """
    Return a reviewer assignment only when its submission is currently
    assigned to the authenticated Section Editor.
    """
    require_section_editor(editor)

    return get_object_or_404(
        ReviewerAssignment.objects.select_related(
            "reviewer",
            "assigned_by",
            "version",
            "version__submission",
            "version__submission__section",
            "version__submission__assigned_editor",
        ),
        pk=assignment_id,
        version__submission__assigned_editor=editor,
    )