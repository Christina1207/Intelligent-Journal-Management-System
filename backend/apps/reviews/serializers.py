from rest_framework import serializers

from apps.workflow.models import ReviewerAssignment
from apps.reviews.models import Review


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


# ------------------------------------------------------------------ #
#  REVIEWER ASSIGNMENT — INPUT                                        #
# ------------------------------------------------------------------ #

class ReviewerAssignmentCreateSerializer(serializers.Serializer):
    """
    Editor assigns a reviewer to a submission.
    submission is taken from the URL — not from request body.
    """
    reviewer_id       = serializers.UUIDField()
    response_deadline = serializers.DateField()
    review_deadline   = serializers.DateField()

    def validate(self, attrs):
        if attrs['response_deadline'] >= attrs['review_deadline']:
            raise serializers.ValidationError(
                "Response deadline must be earlier than the review deadline."
            )
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
    reviewer    = UserBriefSerializer(read_only=True)
    assigned_by = UserBriefSerializer(read_only=True)

    class Meta:
        model  = ReviewerAssignment
        fields = [
            'id',
            # TODO: should this be version instead of submission?
            'submission',
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
    content        = serializers.CharField(allow_blank=False)


# ------------------------------------------------------------------ #
#  REVIEW — OUTPUT                                                    #
# ------------------------------------------------------------------ #

class ReviewSerializer(serializers.ModelSerializer):
    """
    Full review detail — only exposed to editors when submission is REVIEWED.
    Reviewer identity hidden to preserve double-blind integrity.
    """
    recommendation = serializers.CharField(source='get_recommendation_display')
    submitted_at   = serializers.DateTimeField(read_only=True)

    class Meta:
        model  = Review
        fields = [
            'id',
            'recommendation',
            'content',
            'submitted_at',
        ]