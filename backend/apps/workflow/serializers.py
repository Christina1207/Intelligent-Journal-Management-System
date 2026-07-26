from ensurepip import version

from rest_framework import serializers
from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from apps.submissions.serializers import SubmissionListSerializer, SubmissionDetailSectionSerializer
from apps.accounts.serializers import UserProfileSerializer
from apps.accounts.models import User
from .constants import TRIAGE_RESULT_CHOICES
from .models import SubmissionAssignment,TriageAssessment
from apps.submissions.models import Submission, SubmissionVersion

class EligibleSectionEditorSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    active_assignment_count = serializers.IntegerField(
        read_only=True,
    )
    is_current_editor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "affiliation",
            "active_assignment_count",
            "is_current_editor",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, editor):
        full_name = (
            f"{editor.first_name} {editor.last_name}"
        ).strip()

        return full_name or editor.username

    @extend_schema_field(serializers.BooleanField())
    def get_is_current_editor(self, editor):
        submission = self.context.get("submission")

        return bool(
            submission
            and submission.assigned_editor_id == editor.id
        )

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

class TriageCompletedBySerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()

class ManagerSubmissionVersionSerializer(
    serializers.ModelSerializer
):
    manuscript_available = serializers.SerializerMethodField()
    blinded_manuscript_available = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "submitted_at",
            "manuscript_available",
            "blinded_manuscript_available",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_manuscript_available(self, version):
        return bool(version.file)
    
    @extend_schema_field(serializers.BooleanField())
    def get_blinded_manuscript_available(self, version):
        return bool(version.blinded_file)


class ManagerSubmissionDetailSerializer(
    serializers.ModelSerializer
):
    section = SubmissionDetailSectionSerializer(read_only=True)
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "abstract",
            "language",
            "status",
            "section",
            "cover_letter",
            "submitted_at",
            "latest_version",
        ]
        read_only_fields = fields

    @extend_schema_field(
        ManagerSubmissionVersionSerializer(allow_null=True)
    )
    def get_latest_version(self, submission):
        latest_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        if latest_version is None:
            return None

        return ManagerSubmissionVersionSerializer(
            latest_version
        ).data


class ManagerManuscriptDownloadSerializer(
    serializers.Serializer
):
    submission_id = serializers.UUIDField(read_only=True)
    version_id = serializers.UUIDField(read_only=True)
    version_number = serializers.IntegerField(read_only=True)
    expires_in_seconds = serializers.IntegerField(read_only=True)
    manuscript_url = serializers.URLField(read_only=True)

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

    @extend_schema_field(
        serializers.UUIDField(allow_null=True)
    )
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

    @extend_schema_field(
        TriageCompletedBySerializer(allow_null=True)
    )
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
    
class ManagerMonitoringEditorSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "affiliation",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, editor):
        full_name = (
            f"{editor.first_name} {editor.last_name}"
        ).strip()

        return full_name or editor.username


class ManagerReviewProgressSerializer(serializers.Serializer):
    invitations_total = serializers.IntegerField()
    invitations_pending = serializers.IntegerField()
    invitations_accepted = serializers.IntegerField()
    invitations_declined = serializers.IntegerField()
    invitations_expired = serializers.IntegerField()
    reviews_submitted = serializers.IntegerField()
    overdue_invitations = serializers.IntegerField()
    overdue_reviews = serializers.IntegerField()
    invitations_cancelled = serializers.IntegerField()


class ManagerMonitoringSubmissionSerializer(
    serializers.ModelSerializer
):
    section = SubmissionDetailSectionSerializer(read_only=True)
    assigned_editor = ManagerMonitoringEditorSerializer(
        read_only=True,
    )
    latest_version_number = serializers.SerializerMethodField()
    revision_round_count = serializers.SerializerMethodField()
    review_progress = serializers.SerializerMethodField()
    attention_flags = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "status",
            "section",
            "assigned_editor",
            "submitted_at",
            "latest_version_number",
            "revision_round_count",
            "review_progress",
            "attention_flags",
        ]
        read_only_fields = fields

    def _latest_version(self, submission):
        versions = getattr(
            submission,
            "monitoring_versions",
            None,
        )

        if versions is not None:
            return versions[0] if versions else None

        return (
            submission.versions
            .order_by("-version_number")
            .first()
        )

    def _build_review_progress(self, submission):
        version = self._latest_version(submission)

        if version is None:
            assignments = []
        else:
            assignments = getattr(
                version,
                "monitoring_assignments",
                None,
            )

            if assignments is None:
                assignments = list(
                    version.reviewer_assignments
                    .select_related("review")
                    .all()
                )

        now = timezone.now()

        def has_review(assignment):
            return hasattr(assignment, "review")

        return {
            "invitations_total": len(assignments),
            "invitations_pending": sum(
                assignment.status
                == assignment.Status.PENDING
                for assignment in assignments
            ),
            "invitations_accepted": sum(
                assignment.status
                == assignment.Status.ACCEPTED
                for assignment in assignments
            ),
            "invitations_declined": sum(
                assignment.status
                == assignment.Status.DECLINED
                for assignment in assignments
            ),
            "invitations_expired": sum(
                assignment.status
                == assignment.Status.EXPIRED
                for assignment in assignments
            ),
            "reviews_submitted": sum(
                has_review(assignment)
                for assignment in assignments
            ),
            "overdue_invitations": sum(
                assignment.status
                == assignment.Status.PENDING
                and assignment.response_deadline < now
                for assignment in assignments
            ),
            "overdue_reviews": sum(
                assignment.status
                == assignment.Status.ACCEPTED
                and not has_review(assignment)
                and assignment.review_deadline < now
                for assignment in assignments
            ),
            "invitations_cancelled": sum(
                assignment.status
                == assignment.Status.CANCELLED
                for assignment in assignments
            ),
        }

    @extend_schema_field(
        serializers.IntegerField(allow_null=True)
    )
    def get_latest_version_number(self, submission):
        version = self._latest_version(submission)

        return version.version_number if version else None

    @extend_schema_field(serializers.IntegerField())
    def get_revision_round_count(self, submission):
        version = self._latest_version(submission)

        if version is None:
            return 0

        return max(version.version_number - 1, 0)

    @extend_schema_field(ManagerReviewProgressSerializer)
    def get_review_progress(self, submission):
        return self._build_review_progress(submission)

    @extend_schema_field(
        serializers.ListField(
            child=serializers.CharField(),
        )
    )
    def get_attention_flags(self, submission):
        progress = self._build_review_progress(submission)
        flags = []

        if (
            submission.status == submission.Status.ASSIGNED
            and progress["invitations_total"] == 0
        ):
            flags.append("REVIEWER_INVITATIONS_NOT_STARTED")

        if progress["overdue_invitations"] > 0:
            flags.append("OVERDUE_REVIEWER_INVITATIONS")

        if progress["overdue_reviews"] > 0:
            flags.append("OVERDUE_REVIEWS")

        if submission.status == submission.Status.REVIEWED:
            flags.append("EDITOR_DECISION_PENDING")

        if submission.status == submission.Status.UNDER_REVISION:
            flags.append("AUTHOR_REVISION_PENDING")

        return flags