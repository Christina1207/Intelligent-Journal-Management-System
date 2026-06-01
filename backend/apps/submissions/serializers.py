from rest_framework import serializers
from .models import Submission
from apps.journals.serializers import SectionSerializer


class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "abstract",
            "language",
            "cover_letter",
            "section",
        ]
        read_only_fields = ["id"]

    def validate_section(self, section):
        if not section.is_active:
            raise serializers.ValidationError(
                "This section is not accepting new submissions."
            )
        return section


class SubmissionListSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "abstract",
            "language",
            "status",
            "section",
            "submitted_at",
        ]
        read_only_fields = fields