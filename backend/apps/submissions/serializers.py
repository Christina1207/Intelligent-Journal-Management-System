import json
import re
from rest_framework import serializers
from .models import (
    Submission,
    SubmissionCoAuthor,
    SubmissionTopic,
    SubmissionVersion,
)
from apps.journals.models import Section
from apps.journals.serializers import SectionSerializer

#TODO: move this to constants
MAX_MANUSCRIPT_SIZE = 50 * 1024 * 1024

#TODO: move this to policies.py
def validate_pdf_file(uploaded_file):
    if uploaded_file.content_type != "application/pdf":
        raise serializers.ValidationError("Only PDF files are accepted.")

    if uploaded_file.size > MAX_MANUSCRIPT_SIZE:
        raise serializers.ValidationError(
            "File size exceeds the 50MB limit."
        )

    return uploaded_file

class MultipartJSONField(serializers.JSONField):
    default_error_messages = {
        "invalid": "Enter valid JSON.",
    }

    def to_internal_value(self, data):
        if isinstance(data, (str, bytes, bytearray)):
            try:
                if isinstance(data, (bytes, bytearray)):
                    data = data.decode("utf-8")

                data = json.loads(data)
            except (UnicodeDecodeError, json.JSONDecodeError):
                self.fail("invalid")

        return super().to_internal_value(data)


class SubmissionCoAuthorInputSerializer(serializers.Serializer):
    full_name = serializers.CharField(
        max_length=255,
        trim_whitespace=True,
    )
    email = serializers.EmailField()
    affiliation = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )
    orcid = serializers.CharField(
        max_length=19,
        required=False,
        allow_blank=True,
        default="",
    )
    country = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_orcid(self, value):
        normalized = value.strip().upper()

        if normalized and not re.fullmatch(
            r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]",
            normalized,
        ):
            raise serializers.ValidationError(
                "Enter an ORCID in the format 0000-0000-0000-0000."
            )

        return normalized


class SubmissionCoAuthorReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionCoAuthor
        fields = [
            "id",
            "full_name",
            "email",
            "affiliation",
            "orcid",
            "country",
            "order",
        ]
        read_only_fields = fields

class SubmissionCreateSerializer(serializers.Serializer):
    """
    Used for initial submission creation only.
    Inherits from Serializer (not ModelSerializer) because
    file handling requires explicit control.
    """
    title = serializers.CharField(max_length=500)
    abstract = serializers.CharField()
    keywords = MultipartJSONField(
        help_text='JSON array containing 3 to 8 keywords.',
    )
    coauthors = MultipartJSONField(
        required=False,
        default=list,
        write_only=True,
        help_text="JSON array containing ordered coauthor metadata.",
    )
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
    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Keywords must be provided as a JSON array."
            )

        normalized = []
        seen = set()

        for raw_keyword in value:
            if not isinstance(raw_keyword, str):
                raise serializers.ValidationError(
                    "Every keyword must be a string."
                )

            keyword = " ".join(raw_keyword.split())

            if not keyword:
                continue

            if len(keyword) > 100:
                raise serializers.ValidationError(
                    "Each keyword must contain at most 100 characters."
                )

            key = keyword.casefold()

            if key not in seen:
                seen.add(key)
                normalized.append(keyword)

        if not 3 <= len(normalized) <= 8:
            raise serializers.ValidationError(
                "Provide between 3 and 8 distinct keywords."
            )

        return normalized

    def validate_coauthors(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Coauthors must be provided as a JSON array."
            )

        if len(value) > 20:
            raise serializers.ValidationError(
                "A submission cannot contain more than 20 coauthors."
            )

        serializer = SubmissionCoAuthorInputSerializer(
            data=value,
            many=True,
        )
        serializer.is_valid(raise_exception=True)

        coauthors = serializer.validated_data
        seen_emails = set()

        request = self.context.get("request")
        primary_email = (
            getattr(getattr(request, "user", None), "email", "") or ""
        ).casefold()

        for position, coauthor in enumerate(coauthors, start=2):
            email_key = coauthor["email"].casefold()

            if email_key == primary_email:
                raise serializers.ValidationError(
                    "The submitting author must not also be listed as a coauthor."
                )

            if email_key in seen_emails:
                raise serializers.ValidationError(
                    f"Duplicate coauthor email: {coauthor['email']}."
                )

            seen_emails.add(email_key)
            coauthor["order"] = position

        return coauthors

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
            "keywords",
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
    coauthors = SubmissionCoAuthorReadSerializer(
        many=True,
        read_only=True,
    )
    class Meta:
        model = Submission
        fields = [
            "id",
            "title",
            "abstract",
            "keywords",
            "language",
            "status",
            "section",
            "topic",
            "submitted_at",
            "latest_version",
            "coauthors",
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
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        min_length=20,
        max_length=20000,
        help_text=(
            "Point-by-point response explaining how the author "
            "addressed the editor and reviewer comments."
        ),
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
