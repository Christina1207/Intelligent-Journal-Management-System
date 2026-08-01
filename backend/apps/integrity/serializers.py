from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.integrity.models import PlagiarismScreening


User = get_user_model()


class PlagiarismRequesterSerializer(
    serializers.ModelSerializer
):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.CharField())
    def get_full_name(self, user):
        full_name = (
            f"{user.first_name} {user.last_name}"
        ).strip()

        return full_name or user.username


class PlagiarismScreeningSummarySerializer(
    serializers.ModelSerializer
):
    submission_id = serializers.UUIDField(
        source="submission_version.submission_id",
        read_only=True,
    )
    submission_version_id = serializers.UUIDField(
        read_only=True,
    )
    version_number = serializers.IntegerField(
        source="submission_version.version_number",
        read_only=True,
    )
    requested_by = PlagiarismRequesterSerializer(
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = PlagiarismScreening
        fields = [
            "id",
            "submission_id",
            "submission_version_id",
            "version_number",
            "status",
            "requested_by",
            "source_type",
            "pipeline_version",
            "checkpoint_id",
            "report_schema_version",
            "summary",
            "error_code",
            "error_message",
            "created_at",
            "started_at",
            "updated_at",
            "completed_at",
        ]
        read_only_fields = fields


class PlagiarismScreeningDetailSerializer(
    PlagiarismScreeningSummarySerializer
):
    report = serializers.SerializerMethodField()

    class Meta(PlagiarismScreeningSummarySerializer.Meta):
        fields = [
            *PlagiarismScreeningSummarySerializer.Meta.fields,
            "report",
        ]

    @extend_schema_field(
        serializers.JSONField(allow_null=True)
    )
    def get_report(self, screening):
        if (
            screening.status
            != PlagiarismScreening.Status.COMPLETED
        ):
            return None

        return screening.report