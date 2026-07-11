from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class IsSectionManager(BasePermission):
    message = "Only Section Managers can access this endpoint."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_role(Role.RoleName.SECTION_MANAGER)
        )