from django.db.models import Count,Q
from apps.accounts.models import Role, User
from apps.submissions.models import Submission


def submissions_managed_by(user):
    """
    Return only submissions belonging to sections managed by this user.

    This intentionally does not use the shared multi-role submission filter.
    A user who is both an Author and a Section Manager must not see their
    author submissions in the manager queue.
    """
    if (
        not user
        or not user.is_authenticated
        or not user.has_role(Role.RoleName.SECTION_MANAGER)
    ):
        return Submission.objects.none()

    return Submission.objects.filter(section__manager=user)

EDITOR_WORKLOAD_STATUSES = (
    Submission.Status.ASSIGNED,
    Submission.Status.UNDER_REVIEW,
    Submission.Status.SUSPENDED,
    Submission.Status.REVIEWED,
    Submission.Status.UNDER_REVISION,
    Submission.Status.REVISED,
)


def eligible_section_editors_for(submission):
    """
    Return active Section Editors who belong to the submission's
    section, ordered by their total active workload.

    Workload is counted across all sections in which the editor works.
    """
    return (
        User.objects.filter(
            status=User.Status.ACTIVE,
            roles__name=Role.RoleName.SECTION_EDITOR,
            section_editor_memberships__section=submission.section,
            section_editor_memberships__is_active=True,
        )
        .exclude(pk=submission.author_id)
        .annotate(
            active_assignment_count=Count(
                "assigned_submissions",
                filter=Q(
                    assigned_submissions__status__in=(
                        EDITOR_WORKLOAD_STATUSES
                    )
                ),
                distinct=True,
            )
        )
        .order_by(
            "active_assignment_count",
            "last_name",
            "first_name",
            "username",
        )
        .distinct()
    )