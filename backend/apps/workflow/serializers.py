from rest_framework import serializers
from apps.submissions.serializers import SubmissionListSerializer
from apps.accounts.serializers import UserProfileSerializer
from apps.accounts.models import User
from .models import SubmissionAssignment


class AssignEditorSerializer(serializers.Serializer):
    editor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.prefetch_related("roles").all(),
        source="editor",
        write_only=True,
        error_messages={
            "required": "editor_id is required.",
            "does_not_exist": "No user exists with this id.",
            "incorrect_type": "editor_id must be a valid UUID.",
        },
    )

class SubmissionAssignmentSerializer(serializers.ModelSerializer):
    submission = SubmissionListSerializer(read_only=True)
    assigned_to = UserProfileSerializer(read_only=True)
    assigned_by = UserProfileSerializer(read_only=True)

    class Meta:
        model = SubmissionAssignment
        fields = [
            "id",
            "submission",
            "assigned_to",
            "assigned_by",
            "role",
            "created_at",
        ]
        read_only_fields = fields