from django.shortcuts import get_object_or_404
from django.db.models import Count, Q

from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role, User
from apps.submissions.models import Submission
from apps.workflow.models import ReviewerAssignment

from config.constants import MAX_ACTIVE_REVIEWER_ASSIGNMENTS

from .eligibility import (
    ACTIVE_REVIEWER_ASSIGNMENT_STATUSES,
    reviewer_identity_conflict_q,
)

def require_section_editor(user):
    if not user.has_role(Role.RoleName.SECTION_EDITOR):
        raise PermissionDenied(
            "Only Section Editors can perform this action."
        )
def require_reviewer(user):
    if not user.has_role(Role.RoleName.REVIEWER):
        raise PermissionDenied(
            "Only Reviewers can perform this action."
        )


def reviewer_assignment_or_404(
    *,
    reviewer,
    assignment_id,
):
    """
    Return an assignment only when it belongs to the authenticated reviewer.

    A 404 is returned for another reviewer's assignment so its existence and
    manuscript metadata are not disclosed.
    """
    require_reviewer(reviewer)

    return get_object_or_404(
        ReviewerAssignment.objects.select_related(
            "reviewer",
            "version",
            "version__submission",
            "version__submission__section",
        ),
        pk=assignment_id,
        reviewer=reviewer,
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


def reviewer_candidates_for(
    *,
    submission,
    search="",
):
    """
    Return eligible reviewer candidates for manual editor selection.

    Excludes:
    - primary author and coauthors;
    - inactive users;
    - users without the Reviewer role;
    - reviewers outside the submission section;
    - reviewers already invited for the current round;
    - reviewers already active on another version of this submission;
    - reviewers at the configured active-workload capacity.
    """
    current_version = (
        submission.versions
        .order_by("-version_number")
        .first()
    )

    candidates = (
        User.objects.filter(
            status=User.Status.ACTIVE,
            roles__name=Role.RoleName.REVIEWER,
            reviewer_profile__sections=submission.section,
        )
        .exclude(pk=submission.author_id)
        .exclude(
            reviewer_assignments__version__submission=submission,
            reviewer_assignments__status__in=(
                ACTIVE_REVIEWER_ASSIGNMENT_STATUSES
            ),
        )
        .select_related("reviewer_profile")
        .annotate(
            active_assignment_count=Count(
                "reviewer_assignments",
                filter=Q(
                    reviewer_assignments__status__in=(
                        ACTIVE_REVIEWER_ASSIGNMENT_STATUSES
                    )
                ),
                distinct=True,
            )
        )
        .filter(
            active_assignment_count__lt=(
                MAX_ACTIVE_REVIEWER_ASSIGNMENTS
            )
        )
    )

    conflict_query = reviewer_identity_conflict_q(
        submission=submission,
        email_field="email",
    )

    if conflict_query.children:
        candidates = candidates.exclude(conflict_query)

    if current_version is not None:
        candidates = candidates.exclude(
            reviewer_assignments__version=current_version,
        )

    normalized_search = search.strip()

    if normalized_search:
        candidates = candidates.filter(
            Q(username__icontains=normalized_search)
            | Q(first_name__icontains=normalized_search)
            | Q(last_name__icontains=normalized_search)
            | Q(email__icontains=normalized_search)
            | Q(affiliation__icontains=normalized_search)
            | Q(orcid__icontains=normalized_search)
            | Q(
                reviewer_profile__biography__icontains=
                normalized_search
            )
        )

    return (
        candidates
        .order_by(
            "active_assignment_count",
            "last_name",
            "first_name",
            "username",
        )
        .distinct()
    )