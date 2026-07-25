from django.db.models import Count,Q, Prefetch
from apps.accounts.models import Role, User
from apps.submissions.models import Submission, SubmissionVersion
from .models import ReviewerAssignment

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
    Submission.Status.REVIEWED,
    Submission.Status.UNDER_REVISION,
)

EDITOR_ACTIVE_STATUSES = EDITOR_WORKLOAD_STATUSES


def active_submissions_for_editor(user):
    """
    Return active manuscripts currently assigned to this Section Editor.

    Finalized submissions are excluded from the working queue.
    """
    if (
        not user
        or not user.is_authenticated
        or not user.has_role(Role.RoleName.SECTION_EDITOR)
    ):
        return Submission.objects.none()

    return (
        Submission.objects.filter(
            assigned_editor=user,
            status__in=EDITOR_ACTIVE_STATUSES,
        )
        .select_related(
            "section",
            "author",
        )
        .order_by("-submitted_at")
    )

def eligible_section_editors_for(submission):
    """
    Return active Section Editors who belong to the submission's
    section, ordered by their total active workload.

    Workload is counted across all sections in which the editor works.
    """
    return (
        User.objects.filter(
            is_active=True,
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

MANAGER_MONITORED_STATUSES = (
    Submission.Status.ASSIGNED,
    Submission.Status.UNDER_REVIEW,
    Submission.Status.REVIEWED,
    Submission.Status.UNDER_REVISION,
)


def monitored_submissions_for_manager(user):
    """
    Return active manuscripts belonging to sections managed by the user.

    Versions and reviewer assignments are prefetched because the monitoring
    serializer calculates progress for the latest manuscript version.
    """
    return (
        submissions_managed_by(user)
        .filter(status__in=MANAGER_MONITORED_STATUSES)
        .select_related(
            "section",
            "author",
            "assigned_editor",
        )
        .prefetch_related(
            Prefetch(
                "versions",
                queryset=(
                    SubmissionVersion.objects
                    .order_by("-version_number")
                    .prefetch_related(
                        Prefetch(
                            "reviewer_assignments",
                            queryset=(
                                ReviewerAssignment.objects
                                .select_related("reviewer", "review")
                                .order_by("assigned_at")
                            ),
                            to_attr="monitoring_assignments",
                        )
                    )
                ),
                to_attr="monitoring_versions",
            )
        )
        .order_by("-submitted_at")
    )

PRIORITIZABLE_STATUSES = (
    Submission.Status.SUBMITTED,
    Submission.Status.ASSIGNED,
    Submission.Status.UNDER_REVIEW,
    Submission.Status.REVIEWED,
    Submission.Status.UNDER_REVISION,
)


def prioritizable_submissions():
    """
    Return all active journal submissions with the data required by
    SubmissionPriorityService already loaded.

    Authorization is enforced by the EIC analytics endpoint.
    """
    return (
        Submission.objects
        .filter(status__in=PRIORITIZABLE_STATUSES)
        .select_related(
            "section",
            "assigned_editor",
        )
        .prefetch_related(
            Prefetch(
                "versions",
                queryset=(
                    SubmissionVersion.objects
                    .order_by("-version_number")
                    .prefetch_related(
                        Prefetch(
                            "reviewer_assignments",
                            queryset=(
                                ReviewerAssignment.objects
                                .select_related("review")
                                .order_by("assigned_at")
                            ),
                            to_attr="priority_assignments",
                        )
                    )
                ),
                to_attr="priority_versions",
            )
        )
    )
