from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class IsPublishingStaff(BasePermission):
    message = "You do not have permission to access publishing management."

    allowed_roles = {
        Role.RoleName.SECTION_EDITOR,
        Role.RoleName.SECTION_MANAGER,
        Role.RoleName.EDITOR_IN_CHIEF,
        Role.RoleName.ADMIN,
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return user.roles.filter(
            name__in=self.allowed_roles,
        ).exists()


class CanPublishArticle(BasePermission):
    message = (
        "Only the responsible Section Manager, Editor-in-Chief, "
        "or System Administrator can publish an article."
    )

    allowed_roles = {
        Role.RoleName.SECTION_MANAGER,
        Role.RoleName.EDITOR_IN_CHIEF,
        Role.RoleName.ADMIN,
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return user.roles.filter(
            name__in=self.allowed_roles,
        ).exists()