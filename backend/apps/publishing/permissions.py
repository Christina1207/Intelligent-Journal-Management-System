from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class _EditorialRolePermission(BasePermission):
    allowed_roles = frozenset()

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        return user.roles.filter(name__in=self.allowed_roles).exists()


class CanCreatePublicationDraft(_EditorialRolePermission):
    message = (
        "Only authorized editorial users can create publication drafts."
    )
    allowed_roles = frozenset(
        {
            Role.RoleName.SECTION_EDITOR,
            Role.RoleName.SECTION_MANAGER,
            Role.RoleName.EDITOR_IN_CHIEF,
            Role.RoleName.ADMIN,
        }
    )


class IsPublishingStaff(_EditorialRolePermission):
    message = (
        "Only Section Managers, Editors-in-Chief, and System Administrators "
        "can access publishing management."
    )
    allowed_roles = frozenset(
        {
            Role.RoleName.SECTION_MANAGER,
            Role.RoleName.EDITOR_IN_CHIEF,
            Role.RoleName.ADMIN,
        }
    )


class CanPublishArticle(_EditorialRolePermission):
    message = (
        "Only the responsible Section Manager, Editor-in-Chief, "
        "or System Administrator can publish an article."
    )
    allowed_roles = frozenset(
        {
            Role.RoleName.SECTION_MANAGER,
            Role.RoleName.EDITOR_IN_CHIEF,
            Role.RoleName.ADMIN,
        }
    )

class CanManageIssues(_EditorialRolePermission):
    message = (
        "Only the Editor-in-Chief can manage journal issues."
    )
    allowed_roles = frozenset(
        {
            Role.RoleName.EDITOR_IN_CHIEF,
        }
    )