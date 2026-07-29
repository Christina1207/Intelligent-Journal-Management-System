from rest_framework.permissions import BasePermission

from .models import Role


class CanManageReviewerApplications(BasePermission):
    """
    Grants reviewer-application management capability.

    Section-level authorization is enforced separately by the queryset
    and service layer. Editors-in-Chief, administrators, and superusers
    have journal-wide access.
    """

    message = (
        "Only the responsible Section Manager, Editor-in-Chief, "
        "or a system administrator can manage reviewer applications."
    )

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return user.roles.filter(
            name__in=[
                Role.RoleName.SECTION_MANAGER,
                Role.RoleName.EDITOR_IN_CHIEF,
                Role.RoleName.ADMIN,
            ]
        ).exists()