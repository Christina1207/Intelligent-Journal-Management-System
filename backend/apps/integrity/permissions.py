from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class CanManagePlagiarismScreenings(BasePermission):
    message = (
        "Only Section Managers can access plagiarism "
        "screenings."
    )

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.has_role(
                Role.RoleName.SECTION_MANAGER
            )
        )