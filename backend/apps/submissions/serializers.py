from curses import version

from rest_framework import serializers
from .models import Submission, SubmissionTopic, SubmissionVersion
from apps.journals.models import Section
from apps.journals.serializers import SectionSerializer

#TODO: move this to constants
MAX_MANUSCRIPT_SIZE = 50 * 1024 * 1024


def validate_pdf_file(uploaded_file):
    if uploaded_file.content_type != "application/pdf":
        raise serializers.ValidationError("Only PDF files are accepted.")

    if uploaded_file.size > MAX_MANUSCRIPT_SIZE:
        raise serializers.ValidationError(
            "File size exceeds the 50MB limit."
        )

    return uploaded_file

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
    file = serializers.FileField(
        validators=[validate_pdf_file],
        help_text="Full manuscript PDF containing author information.",
    )

    blinded_file = serializers.FileField(
        validators=[validate_pdf_file],
        help_text="Anonymized manuscript PDF for peer reviewers.",
    )

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

class AuthorReviewFeedbackSerializer(serializers.Serializer):
    reviewer_label = serializers.CharField()
    comments_for_author = serializers.CharField()

class SubmissionVersionSerializer(serializers.ModelSerializer):
    full_manuscript_available = serializers.SerializerMethodField()
    blinded_manuscript_available = serializers.SerializerMethodField()
    reviewer_feedback = serializers.SerializerMethodField()

    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "full_manuscript_available",
            "blinded_manuscript_available",
            "submitted_at",
            "decision",
            "decision_letter",
            "response_to_reviewers",
            "reviewer_feedback",
            "decided_at",
            "decided_by",
        ]
        read_only_fields = fields

    def get_full_manuscript_available(self, version):
        return bool(version.file)

    def get_blinded_manuscript_available(self, version):
        return bool(version.blinded_file)
    
    def get_reviewer_feedback(self, version):
        """
        Release only author-directed comments after an editorial decision.

        Reviewer identity, recommendation, and confidential editor comments
        deliberately remain outside this representation.
        """
        if version.decision == SubmissionVersion.Decision.PENDING:
            return []

        assignments = getattr(
            version,
            "author_feedback_assignments",
            None,
        )

        if assignments is None:
            assignments = (
                version.reviewer_assignments
                .select_related("review")
                .order_by("assigned_at", "id")
            )

        feedback = []

        for assignment in assignments:
            if not hasattr(assignment, "review"):
                continue

            feedback.append(
                {
                    "reviewer_label": (
                        f"Reviewer {len(feedback) + 1}"
                    ),
                    "comments_for_author": (
                        assignment.review.comments_for_author
                    ),
                }
            )

        return AuthorReviewFeedbackSerializer(
            feedback,
            many=True,
        ).data


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


class AuthorDashboardSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField(read_only=True)
    active = serializers.IntegerField(read_only=True)
    needs_revision = serializers.IntegerField(read_only=True)
    accepted = serializers.IntegerField(read_only=True)
    rejected = serializers.IntegerField(read_only=True)


class AuthorDashboardSubmissionSerializer(serializers.ModelSerializer):
    section = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "status",
            "section",
            "submitted_at",
        ]
        read_only_fields = fields


class AuthorDashboardActionSerializer(AuthorDashboardSubmissionSerializer):
    action = serializers.SerializerMethodField()

    class Meta(AuthorDashboardSubmissionSerializer.Meta):
        fields = AuthorDashboardSubmissionSerializer.Meta.fields + [
            "action",
        ]
        read_only_fields = fields

    def get_action(self, obj):
        return "UPLOAD_REVISION"


class AuthorDashboardSerializer(serializers.Serializer):
    summary = AuthorDashboardSummarySerializer(read_only=True)
    action_required = AuthorDashboardActionSerializer(many=True, read_only=True)
    recent_submissions = AuthorDashboardSubmissionSerializer(many=True, read_only=True)


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
    file = serializers.FileField(
        validators=[validate_pdf_file],
        help_text="Full manuscript PDF containing author information.",
    )
    blinded_file = serializers.FileField(
        validators=[validate_pdf_file],
        help_text="Anonymized manuscript PDF for peer reviewers.",
    )
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
