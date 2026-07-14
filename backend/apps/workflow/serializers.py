from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from apps.submissions.serializers import SubmissionListSerializer
from apps.accounts.serializers import UserProfileSerializer
from apps.accounts.models import User
from .constants import TRIAGE_RESULT_CHOICES
from .models import SubmissionAssignment,TriageAssessment


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

REASSIGNMENT_REASON_CHOICES = [
    choice
    for choice in SubmissionAssignment.AssignmentReason.choices
    if choice[0] != SubmissionAssignment.AssignmentReason.INITIAL
]


class ReassignEditorSerializer(AssignEditorSerializer):
    reason = serializers.ChoiceField(
        choices=REASSIGNMENT_REASON_CHOICES,
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
            "assignment_reason",
            "created_at",
        ]
        read_only_fields = fields

class TriageCheckInputSerializer(serializers.Serializer):
    code = serializers.SlugField(max_length=100)
    result = serializers.ChoiceField(
        choices=TRIAGE_RESULT_CHOICES,
    )
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
    )


class TriageUpdateSerializer(serializers.Serializer):
    internal_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=10000,
    )
    checks = TriageCheckInputSerializer(
        many=True,
        required=False,
    )

    def validate_checks(self, checks):
        codes = [check["code"] for check in checks]

        if len(codes) != len(set(codes)):
            raise serializers.ValidationError(
                "Each checklist item may appear only once."
            )

        return checks

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError(
                "Provide internal_notes, checks, or both."
            )

        return attrs


class DeskRejectSerializer(serializers.Serializer):
    reason_code = serializers.ChoiceField(
        choices=TriageAssessment.RejectionReason.choices,
    )
    author_message = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        min_length=20,
        max_length=5000,
    )


class TriageCheckStateSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    required = serializers.BooleanField()
    allow_not_applicable = serializers.BooleanField()
    result = serializers.CharField(allow_null=True)
    note = serializers.CharField()


class PlagiarismPlaceholderSerializer(serializers.Serializer):
    status = serializers.CharField()
    report = serializers.JSONField(allow_null=True)


class TriageAssessmentDetailSerializer(serializers.Serializer):
    assessment_id = serializers.SerializerMethodField()
    submission_id = serializers.UUIDField(
        source="submission_version.submission_id",
        read_only=True,
    )
    version_id = serializers.UUIDField(
        source="submission_version_id",
        read_only=True,
    )
    checklist_version = serializers.IntegerField(read_only=True)
    status = serializers.SerializerMethodField()
    outcome = serializers.SerializerMethodField()
    checks = serializers.SerializerMethodField()
    internal_notes = serializers.CharField(read_only=True)
    rejection_reason = serializers.SerializerMethodField()
    author_message = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(
        allow_null=True,
        read_only=True,
    )
    updated_at = serializers.DateTimeField(
        allow_null=True,
        read_only=True,
    )
    completed_at = serializers.DateTimeField(
        allow_null=True,
        read_only=True,
    )
    completed_by = serializers.SerializerMethodField()
    plagiarism_screening = serializers.SerializerMethodField()

    def get_assessment_id(self, assessment):
        if assessment.pk is None:
            return None
        return str(assessment.pk)

    @extend_schema_field(serializers.CharField())
    def get_status(self, assessment):
        if assessment.pk is None:
            return "NOT_STARTED"
        return assessment.status

    @extend_schema_field(
        serializers.CharField(allow_null=True)
    )
    def get_outcome(self, assessment):
        return assessment.outcome or None

    @extend_schema_field(
        serializers.CharField(allow_null=True)
    )
    def get_rejection_reason(self, assessment):
        return assessment.rejection_reason or None

    @extend_schema_field(
        TriageCheckStateSerializer(many=True)
    )
    def get_checks(self, assessment):
        from apps.workflow.constants import get_triage_checklist

        definitions = get_triage_checklist(
            assessment.checklist_version
        )
        saved_checks = assessment.checks or {}

        return [
            {
                "code": definition["code"],
                "label": definition["label"],
                "description": definition["description"],
                "required": definition["required"],
                "allow_not_applicable": (
                    definition["allow_not_applicable"]
                ),
                "result": saved_checks.get(
                    definition["code"],
                    {},
                ).get("result"),
                "note": saved_checks.get(
                    definition["code"],
                    {},
                ).get("note", ""),
            }
            for definition in definitions
        ]

    def get_completed_by(self, assessment):
        user = assessment.completed_by

        if user is None:
            return None

        full_name = (
            f"{user.first_name} {user.last_name}"
        ).strip()

        return {
            "id": str(user.id),
            "full_name": full_name or user.username,
        }

    @extend_schema_field(PlagiarismPlaceholderSerializer)
    def get_plagiarism_screening(self, assessment):
        return {
            "status": "NOT_AVAILABLE",
            "report": None,
        }