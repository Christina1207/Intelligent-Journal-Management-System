from rest_framework import serializers
from .models import Submission, SubmissionTopic, SubmissionVersion
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
            "decided_at",
            "decided_by",
        ]
        read_only_fields = fields


class SubmissionTopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionTopic
        fields = ["label", "keywords"]
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

class RevisionUploadSerializer(serializers.Serializer):
    """
    Used for revision upload only. File validation mirrors
    SubmissionCreateSerializer.
    """
    file = serializers.FileField()
    review_deadline = serializers.DateTimeField()

    def validate_file(self, file):
        if file.content_type != "application/pdf":
            raise serializers.ValidationError("Only PDF files are accepted.")
        max_size = 50 * 1024 * 1024
        if file.size > max_size:
            raise serializers.ValidationError("File size exceeds the 50MB limit.")
        return file