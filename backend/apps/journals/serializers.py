from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import Section
from apps.accounts.models import Role, User


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "description", "issn", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]

class SectionManagementSerializer(serializers.ModelSerializer):
    manager = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "description",
            "issn",
            "manager",
            "is_active",
            "created_at",
            "last_clustered_at",
        ]
        read_only_fields = [
            "id",
            "manager",
            "created_at",
            "last_clustered_at",
        ]

    def get_manager(self, obj):
        if not obj.manager:
            return None

        return {
            "id": str(obj.manager.id),
            "username": obj.manager.username,
            "email": obj.manager.email,
            "full_name": f"{obj.manager.first_name} {obj.manager.last_name}".strip(),
        }

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        user = request.user

        if not user.has_role(Role.RoleName.EDITOR_IN_CHIEF):
            eic_only_fields = {"is_active"}

            forbidden_fields = eic_only_fields.intersection(attrs.keys())

            if forbidden_fields:
                raise PermissionDenied(
                    "Only the editor-in-chief can activate or deactivate sections."
                )

        return attrs
    
class AssignSectionManagerSerializer(serializers.Serializer):
    manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.prefetch_related("roles").all(),
        source="manager",
        write_only=True,
        error_messages={
            "required": "manager_id is required.",
            "does_not_exist": "No user exists with this id.",
            "incorrect_type": "manager_id must be a valid UUID.",
        },
    )

    def validate_manager_id(self, manager):
        if not manager.has_role(Role.RoleName.SECTION_MANAGER):
            raise serializers.ValidationError(
                "Selected user must have the SECTION_MANAGER role."
            )

        if manager.status != User.Status.ACTIVE:
            raise serializers.ValidationError(
                "Cannot assign an inactive user as section manager."
            )

        return manager