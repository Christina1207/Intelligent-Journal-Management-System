from rest_framework import serializers
from .models import Submission, SubmissionTopic, SubmissionVersion
from apps.journals.models import Section
from apps.journals.serializers import SectionSerializer


class SubmissionCreateSerializer(serializers.Serializer):
    """
    Used for initial submission creation only.
    Inherits from Serializer (not ModelSerializer) because
    file handling requires explicit control.
    """
    title = serializers.CharField(max_length=500)
    abstract = serializers.CharField()
    language = serializers.ChoiceField(choices=Submission._meta.get_field("language").choices)
    cover_letter = serializers.CharField(required=False, allow_blank=True, default="")
    section = serializers.PrimaryKeyRelatedField(
        queryset=__import__(
            "apps.journals.models", fromlist=["Section"]
        ).Section.objects.filter(is_active=True)
    )
    file = serializers.FileField()

    def validate_section(self, section):
        if not section.is_active:
            raise serializers.ValidationError(
                "This section is not accepting new submissions."
            )
        return section

    def validate_file(self, file):
        # Industry standard: MIME type check, not extension only
        if file.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted.")
        max_size = 50 * 1024 * 1024  # 50MB
        if file.size > max_size:
            raise serializers.ValidationError(
                "File size exceeds the 50MB limit."
            )
        return file


class SubmissionVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "file",
            "submitted_at",
            "decision",
            "decision_letter",
            "response_to_reviewers",
            "decided_at",
            "decided_by",
        ]
        read_only_fields = fields


class SubmissionTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionTopic
        fields = ["label", "keywords"]
        read_only_fields = fields


class SubmissionDetailSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "slug"]
        read_only_fields = fields


class SubmissionLatestVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "decision",
            "decision_letter",
            "submitted_at",
        ]
        read_only_fields = fields


class SubmissionListSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)
    topic = SubmissionTopicSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "abstract",
            "language",
            "status",
            "section",
            "topic",
            "submitted_at",
        ]
        read_only_fields = fields


class SubmissionDetailSerializer(serializers.ModelSerializer):
    section = SubmissionDetailSectionSerializer(read_only=True)
    topic = SubmissionTopicSerializer(read_only=True)
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
            "topic",
            "submitted_at",
            "latest_version",
        ]
        read_only_fields = fields

    def get_latest_version(self, obj):
        versions = getattr(obj, "prefetched_versions", None)
        if versions is not None:
            latest_version = versions[0] if versions else None
        else:
            latest_version = obj.versions.order_by("-version_number").first()

        if latest_version is None:
            return None

        return SubmissionLatestVersionSerializer(latest_version).data


class RevisionUploadSerializer(serializers.Serializer):
    """
    Used for revision upload only. File validation mirrors
    SubmissionCreateSerializer.
    """
    file = serializers.FileField()
    response_to_reviewers = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, attrs):
        if "review_deadline" in self.initial_data:
            raise serializers.ValidationError(
                {
                    "review_deadline": (
                        "This field is managed by the editorial workflow "
                        "and must not be submitted by authors."
                    )
                }
            )
        return attrs

    def validate_file(self, file):
        if file.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted.")
        max_size = 50 * 1024 * 1024
        if file.size > max_size:
            raise serializers.ValidationError("File size exceeds the 50MB limit.")
        return file
