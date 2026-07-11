from apps.accounts.models import Role
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