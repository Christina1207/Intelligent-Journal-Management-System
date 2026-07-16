from rest_framework import serializers

from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist

from apps.accounts.models import User
from apps.workflow.models import ReviewerAssignment
from apps.reviews.models import Review
from apps.submissions.models import SubmissionVersion


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

    def get_full_name(self, instance):
        first_name = getattr(instance, "first_name", "") or ""
        last_name = getattr(instance, "last_name", "") or ""
        full_name = f"{first_name} {last_name}".strip()

        return full_name or instance.email

class SubmissionVersionBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    version_number = serializers.IntegerField()
    submitted_at = serializers.DateTimeField()
    decision = serializers.CharField()


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

    def get_full_name(self, reviewer):
        full_name = (
            f"{reviewer.first_name} {reviewer.last_name}"
        ).strip()

        return full_name or reviewer.username

    def get_keywords(self, reviewer):
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
        ]
        
    def get_submission(self, instance):
        # version is select_related in every callsite — no extra query.
        return SubmissionBriefSerializer(instance.version.submission).data
    
    def get_version(self, instance):
        return SubmissionVersionBriefSerializer(instance.version).data
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        is_editor = self.context.get('is_editor', False)
        if not is_editor:
            data.pop('assigned_by', None)
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