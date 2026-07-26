from rest_framework import serializers

from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist

from apps.accounts.models import User
from apps.workflow.models import ReviewerAssignment
from apps.reviews.models import Review
from apps.submissions.models import SubmissionVersion

from drf_spectacular.utils import extend_schema_field

from config.constants import MAX_REVIEWER_INVITATIONS_PER_BATCH

# ------------------------------------------------------------------ #
#  SHARED NESTED SERIALIZERS                                          #
# ------------------------------------------------------------------ #

class SubmissionBriefSerializer(serializers.Serializer):
    """
    Minimal submission detail exposed to reviewers.
    Read-only. No cover letter.
    """
    id       = serializers.UUIDField()
    title    = serializers.CharField()
    abstract = serializers.CharField()
    language = serializers.CharField()
    section  = serializers.StringRelatedField()


class UserBriefSerializer(serializers.Serializer):
    """
    Minimal user detail for nested representation.
    """
    id    = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, instance)-> str:
        first_name = getattr(instance, "first_name", "") or ""
        last_name = getattr(instance, "last_name", "") or ""
        full_name = f"{first_name} {last_name}".strip()

        return full_name or instance.email

class SubmissionVersionBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    version_number = serializers.IntegerField()
    submitted_at = serializers.DateTimeField()
    decision = serializers.CharField()
    response_to_reviewers = serializers.CharField()


class ReviewerCandidateSearchQuerySerializer(serializers.Serializer):
    search = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
        max_length=100,
        default="",
    )
    limit = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=50,
        default=20,
    )


class ReviewerCandidateSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    keywords = serializers.SerializerMethodField()
    active_assignment_count = serializers.IntegerField(
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "full_name",
            "email",
            "orcid",
            "affiliation",
            "country",
            "keywords",
            "active_assignment_count",
        ]
        read_only_fields = fields

    def get_full_name(self, reviewer) -> str:
        full_name = (
            f"{reviewer.first_name} {reviewer.last_name}"
        ).strip()

        return full_name or reviewer.username

    def get_keywords(self, reviewer) -> list:
        try:
            return reviewer.reviewer_profile.keywords or []
        except ObjectDoesNotExist:
            return []

# ------------------------------------------------------------------ #
#  REVIEWER ASSIGNMENT — INPUT                                        #
# ------------------------------------------------------------------ #

class ReviewerAssignmentCreateSerializer(serializers.Serializer):
    """
    Editor assigns a reviewer to a submission.
    submission is taken from the URL — not from request body.
    """
    reviewer_id       = serializers.UUIDField()
    response_deadline = serializers.DateTimeField()
    review_deadline = serializers.DateTimeField()

    def validate(self, attrs):
        response_deadline = attrs["response_deadline"]
        review_deadline = attrs["review_deadline"]
        now = timezone.now()

        errors = {}

        if response_deadline <= now:
            errors["response_deadline"] = (
                "Response deadline must be in the future."
            )

        if review_deadline <= now:
            errors["review_deadline"] = (
                "Review deadline must be in the future."
            )

        if response_deadline >= review_deadline:
            errors["review_deadline"] = (
                "Review deadline must be later than "
                "the response deadline."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

class ReviewerAssignmentsBulkCreateSerializer(serializers.Serializer):
    reviewer_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        min_length=1,
        max_length=MAX_REVIEWER_INVITATIONS_PER_BATCH,
    )
    response_deadline = serializers.DateTimeField()
    review_deadline = serializers.DateTimeField()

    def validate_reviewer_ids(self, reviewer_ids):
        if len(reviewer_ids) != len(set(reviewer_ids)):
            raise serializers.ValidationError(
                "Each reviewer may appear only once."
            )

        return reviewer_ids

    def validate(self, attrs):
        response_deadline = attrs["response_deadline"]
        review_deadline = attrs["review_deadline"]
        now = timezone.now()

        errors = {}

        if response_deadline <= now:
            errors["response_deadline"] = (
                "Response deadline must be in the future."
            )

        if review_deadline <= now:
            errors["review_deadline"] = (
                "Review deadline must be in the future."
            )

        if response_deadline >= review_deadline:
            errors["review_deadline"] = (
                "Review deadline must be later than "
                "the response deadline."
            )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

class ReviewerAssignmentCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        min_length=10,
        max_length=2000,
    )


class ReviewerAssignmentReplaceSerializer(
    ReviewerAssignmentCreateSerializer
):
    reason = serializers.CharField(
        allow_blank=False,
        trim_whitespace=True,
        min_length=10,
        max_length=2000,
    )

class ReviewerAssignmentResponseSerializer(serializers.Serializer):
    """
    Reviewer accepts or declines an assignment.
    """
    accept = serializers.BooleanField()


# ------------------------------------------------------------------ #
#  REVIEWER ASSIGNMENT — OUTPUT                                       #
# ------------------------------------------------------------------ #

class ReviewerAssignmentSerializer(serializers.ModelSerializer):
    """
    Full assignment detail.
    Pass context={'is_editor': True} to expose assigned_by.
    Reviewer-facing: assigned_by is hidden.
    
    `submission` is derived from version.submission — the model FK is
    `version` (SubmissionVersion), not submission directly.
    """
    is_overdue = serializers.BooleanField(read_only=True)
    submission  = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()
    reviewer    = UserBriefSerializer(read_only=True)
    assigned_by = UserBriefSerializer(read_only=True)
    cancelled_by = UserBriefSerializer(read_only=True)
    
    review_submitted = serializers.SerializerMethodField()
    can_respond = serializers.SerializerMethodField()
    can_download_manuscript = serializers.SerializerMethodField()
    can_submit_review = serializers.SerializerMethodField()
    
    replaces = serializers.UUIDField(
        source="replaces_id",
        allow_null=True,
        read_only=True,
    )
    class Meta:
        model  = ReviewerAssignment
        fields = [
            'id',
            'submission',
            'version',
            'reviewer',
            'assigned_by',
            'status',
            'response_deadline',
            'review_deadline',
            'assigned_at',
            'is_overdue',
            "review_submitted",
            "can_respond",
            "can_download_manuscript",
            "can_submit_review",
            "cancelled_at",
            "cancelled_by",
            "cancellation_reason",
            "replaces",
        ]

    @extend_schema_field(SubmissionBriefSerializer)
    def get_submission(self, instance):
        return SubmissionBriefSerializer(instance.version.submission).data
    
    @extend_schema_field(SubmissionVersionBriefSerializer)
    def get_version(self, instance):
        return SubmissionVersionBriefSerializer(instance.version).data
    
    def get_review_submitted(self, instance) -> bool:
        try:
            instance.review
        except ObjectDoesNotExist:
            return False

        return True

    def get_can_respond(self, instance) -> bool:
        return (
            instance.status == ReviewerAssignment.Status.PENDING
            and instance.response_deadline > timezone.now()
        )

    def get_can_download_manuscript(self, instance) -> bool:
        return instance.status == ReviewerAssignment.Status.ACCEPTED

    def get_can_submit_review(self, instance) -> bool:
        return (
            instance.status == ReviewerAssignment.Status.ACCEPTED
            and not self.get_review_submitted(instance)
        )
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        is_editor = self.context.get('is_editor', False)
        if not is_editor:
            data.pop("assigned_by", None)
            data.pop("cancelled_by", None)
            data.pop("replaces", None)
        return data


# ------------------------------------------------------------------ #
#  REVIEW — INPUT                                                     #
# ------------------------------------------------------------------ #

class ReviewSubmitSerializer(serializers.Serializer):
    recommendation = serializers.ChoiceField(choices=Review.Recommendation.choices)
    comments_for_author = serializers.CharField(allow_blank=False)
    comments_for_editor = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


# ------------------------------------------------------------------ #
#  REVIEW — OUTPUT                                                    #
# ------------------------------------------------------------------ #

class ReviewSerializer(serializers.ModelSerializer):
    """
    Editor-facing full review detail.
    Includes reviewer identity for editorial decision-making.
    """
    recommendation = serializers.CharField(source='get_recommendation_display')
    submitted_at   = serializers.DateTimeField(read_only=True)
    reviewer = serializers.SerializerMethodField()

    class Meta:
        model  = Review
        fields = [
            'id',
            'reviewer',
            'recommendation',
            'comments_for_author',
            'comments_for_editor',
            'submitted_at',
        ]
    @extend_schema_field(UserBriefSerializer)
    def get_reviewer(self, instance):
        return UserBriefSerializer(instance.assignment.reviewer).data

class AuthorReviewSerializer(serializers.ModelSerializer):
    recommendation = serializers.CharField(source="get_recommendation_display")

    class Meta:
        model = Review
        fields = [
            "id",
            "recommendation",
            "comments_for_author",
        ]

class EditorDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(
        choices=SubmissionVersion.Decision.choices
    )
    decision_letter = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_decision(self, value):
        if value == SubmissionVersion.Decision.PENDING:
            raise serializers.ValidationError("PENDING is not a valid editor decision.")
        return value
    
class SubmissionVersionDecisionSerializer(serializers.ModelSerializer):
    decision = serializers.CharField(source="get_decision_display")
    decided_by = UserBriefSerializer(read_only=True)

    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "decision",
            "decision_letter",
            "decided_at",
            "decided_by",
        ]

class EditorReviewVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionVersion
        fields = [
            "id",
            "version_number",
            "decision",
            "decision_letter",
            "response_to_reviewers",
            "submitted_at",
            "decided_at",
        ]
        read_only_fields = fields


class EditorReviewProgressSerializer(serializers.Serializer):
    total_invitations = serializers.IntegerField()
    pending = serializers.IntegerField()
    accepted = serializers.IntegerField()
    declined = serializers.IntegerField()
    expired = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    submitted = serializers.IntegerField()
    overdue = serializers.IntegerField()


class EditorReviewWorkspaceSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    submission_status = serializers.CharField()
    current_version = EditorReviewVersionSerializer(
        allow_null=True,
    )
    required_reviews = serializers.IntegerField()
    progress = EditorReviewProgressSerializer()
    assignments = ReviewerAssignmentSerializer(many=True)
    reviews_available = serializers.BooleanField()
    reviews_unavailable_reason = serializers.CharField(
        allow_blank=True,
    )
    reviews = ReviewSerializer(many=True)
    can_make_decision = serializers.BooleanField()

# ------------------------------------------------------------------ #
#  API RESPONSE ENVELOPES                                             #
# ------------------------------------------------------------------ #

class ReviewerAssignmentsBulkResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=0)
    assignments = ReviewerAssignmentSerializer(many=True)


class ReviewerRecommendationSerializer(serializers.Serializer):
    reviewer_id = serializers.UUIDField()
    full_name = serializers.CharField()
    email = serializers.EmailField()
    affiliation = serializers.CharField(allow_blank=True)
    keywords = serializers.ListField(
        child=serializers.CharField(),
    )
    biography_excerpt = serializers.CharField(allow_blank=True)
    similarity_score = serializers.FloatField(
        min_value=0,
        max_value=1,
    )
    keyword_overlap_score = serializers.FloatField(
        min_value=0,
        max_value=1,
    )
    recommendation_score = serializers.FloatField(
        min_value=0,
        max_value=1,
    )
    scoring_mode = serializers.ChoiceField(
        choices=[
            "hybrid",
            "semantic_only",
            "keyword_only",
            "unavailable",
        ]
    )
    matched_keywords = serializers.ListField(
        child=serializers.CharField(),
    )
    matched_author_keywords = serializers.ListField(
        child=serializers.CharField(),
    )
    matched_topic_keywords = serializers.ListField(
        child=serializers.CharField(),
    )
    active_assignment_count = serializers.IntegerField(
        min_value=0,
    )
    has_reviewed_before = serializers.BooleanField()
    explanation = serializers.CharField()


class ReviewerRecommendationsResponseSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    count = serializers.IntegerField(min_value=0)
    recommendations = ReviewerRecommendationSerializer(many=True)


class ReviewerCandidateSearchResponseSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    count = serializers.IntegerField(min_value=0)
    candidates = ReviewerCandidateSerializer(many=True)


class EditorDecisionResponseSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    submission_status = serializers.CharField()
    version = SubmissionVersionDecisionSerializer()


class ReviewerManuscriptDownloadSerializer(serializers.Serializer):
    assignment_id = serializers.UUIDField()
    submission_id = serializers.UUIDField()
    version_id = serializers.UUIDField()
    version_number = serializers.IntegerField(min_value=1)
    expires_in_seconds = serializers.IntegerField(min_value=1)
    manuscript_url = serializers.URLField()


class ReviewerAssignmentReplacementResponseSerializer(
    serializers.Serializer
):
    cancelled_assignment = ReviewerAssignmentSerializer()
    replacement_assignment = ReviewerAssignmentSerializer()