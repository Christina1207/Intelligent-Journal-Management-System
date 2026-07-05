from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class IsEditorInChief(BasePermission):
    """
    Allows access only to users with the EDITOR_IN_CHIEF role.
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.has_role(Role.RoleName.EDITOR_IN_CHIEF)
        )


class SectionManagementPermission(BasePermission):
    """
    Section management rules:

    - Create section: Editor-in-chief only.
    - Delete section: Editor-in-chief only.
    - Assign section manager: Editor-in-chief only.
    - Update section: Editor-in-chief or this section's assigned manager.
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        is_editor_in_chief = request.user.has_role(Role.RoleName.EDITOR_IN_CHIEF)
        is_section_manager = request.user.has_role(Role.RoleName.SECTION_MANAGER)

        if view.action in ["create", "destroy", "assign_manager"]:
            return is_editor_in_chief

        if view.action in ["list", "retrieve", "update", "partial_update"]:
            return is_editor_in_chief or is_section_manager

        return is_editor_in_chief

    def has_object_permission(self, request, view, obj):
        if request.user.has_role(Role.RoleName.EDITOR_IN_CHIEF):
            return True

        if view.action in ["retrieve", "update", "partial_update"]:
            return (
                request.user.has_role(Role.RoleName.SECTION_MANAGER)
                and obj.manager_id == request.user.id
            )

        return False