from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import Section
from apps.accounts.models import Role, User
from drf_spectacular.utils import extend_schema_field

class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "name", "slug", "description", "issn", "is_active", "created_at"]
        read_only_fields = ["id","slug", "created_at"]

class SectionManagerBriefSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    username = serializers.CharField()
    email = serializers.EmailField()
    full_name = serializers.CharField(allow_blank=True)

class SectionManagementSerializer(serializers.ModelSerializer):
    manager = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "issn",
            "manager",
            "is_active",
            "created_at",
            "last_clustered_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "manager",
            "created_at",
            "last_clustered_at",
        ]

    @extend_schema_field(SectionManagerBriefSerializer(allow_null=True))
    def get_manager(self, obj):
        if not obj.manager:
            return None

        return {
            "id": str(obj.manager.id),
            "username": obj.manager.username,
            "email": obj.manager.email,
            "full_name": f"{obj.manager.first_name} {obj.manager.last_name}".strip(),
        }

    def validate(self, attrs):
        request = self.context.get("request")

        if not request:
            return attrs

        user = request.user

        if not user.has_role(Role.RoleName.EDITOR_IN_CHIEF):
            eic_only_fields = {"is_active"}

            forbidden_fields = eic_only_fields.intersection(attrs.keys())

            if forbidden_fields:
                raise PermissionDenied(
                    "Only the editor-in-chief can activate or deactivate sections."
                )

        return attrs
    
class AssignSectionManagerSerializer(serializers.Serializer):
    manager_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.prefetch_related("roles").all(),
        source="manager",
        write_only=True,
        error_messages={
            "required": "manager_id is required.",
            "does_not_exist": "No user exists with this id.",
            "incorrect_type": "manager_id must be a valid UUID.",
        },
    )

    def validate_manager_id(self, manager):
        if not manager.has_role(Role.RoleName.SECTION_MANAGER):
            raise serializers.ValidationError(
                "Selected user must have the SECTION_MANAGER role."
            )

        if not manager.is_active:
            raise serializers.ValidationError(
                "Cannot assign an inactive user as section manager."
            )

        return manager

class TopicKeywordCountSerializer(serializers.Serializer):
    keyword = serializers.CharField()
    submission_count = serializers.IntegerField(
        min_value=0,
    )


class TopicAggregateSerializer(serializers.Serializer):
    label = serializers.CharField()
    submission_count = serializers.IntegerField(
        min_value=0,
    )
    percentage_of_clustered = serializers.FloatField(
        min_value=0,
        max_value=100,
    )
    keywords = serializers.ListField(
        child=serializers.CharField(),
    )


class TopicAnalyticsSectionSummarySerializer(
    serializers.Serializer
):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()


class SectionTopicAnalyticsSerializer(
    serializers.Serializer
):
    section = TopicAnalyticsSectionSummarySerializer()
    analysis_status = serializers.ChoiceField(
        choices=[
            "not_started",
            "partial",
            "complete",
        ]
    )
    last_clustered_at = serializers.DateTimeField(
        allow_null=True,
    )
    total_submissions = serializers.IntegerField(
        min_value=0,
    )
    analyzed_submissions = serializers.IntegerField(
        min_value=0,
    )
    clustered_submissions = serializers.IntegerField(
        min_value=0,
    )
    outlier_submissions = serializers.IntegerField(
        min_value=0,
    )
    pending_analysis = serializers.IntegerField(
        min_value=0,
    )
    topics = TopicAggregateSerializer(many=True)
    top_author_keywords = (
        TopicKeywordCountSerializer(many=True)
    )


class TopicAnalyticsDashboardSerializer(
    serializers.Serializer
):
    generated_at = serializers.DateTimeField()
    sections = SectionTopicAnalyticsSerializer(
        many=True,
    )

class EditorialAnalyticsSummarySerializer(
    serializers.Serializer
):
    total_submissions = serializers.IntegerField()
    total_publications = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()
    acceptance_rate = serializers.FloatField()
    rejection_rate = serializers.FloatField()
    median_decision_duration_days = serializers.FloatField(
        allow_null=True,
    )
    median_review_duration_days = serializers.FloatField(
        allow_null=True,
    )


class AnalyticsStatusCountSerializer(serializers.Serializer):
    code = serializers.CharField()
    label = serializers.CharField()
    count = serializers.IntegerField()


class AnalyticsTimePointSerializer(serializers.Serializer):
    month = serializers.DateField()
    count = serializers.IntegerField()


class AnalyticsSectionCountSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    submission_count = serializers.IntegerField()


class AnalyticsTopicCountSerializer(serializers.Serializer):
    label = serializers.CharField()
    submission_count = serializers.IntegerField()


class AnalyticsTopicDistributionSerializer(
    serializers.Serializer
):
    topics = AnalyticsTopicCountSerializer(many=True)
    unclassified_count = serializers.IntegerField()


class AnalyticsOverdueWorkSerializer(serializers.Serializer):
    overdue_invitations = serializers.IntegerField()
    overdue_reviews = serializers.IntegerField()
    total = serializers.IntegerField()


class PrioritySectionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class PriorityEditorSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    full_name = serializers.CharField()


class PriorityFactorSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    score = serializers.FloatField()
    weight = serializers.IntegerField()
    contribution = serializers.FloatField()
    details = serializers.JSONField()
    explanation = serializers.CharField()


class PriorityQueueItemSerializer(serializers.Serializer):
    submission_id = serializers.UUIDField()
    title = serializers.CharField()
    status = serializers.CharField()
    section = PrioritySectionSerializer()
    assigned_editor = PriorityEditorSerializer(
        allow_null=True,
    )
    submitted_at = serializers.DateTimeField()
    latest_version_number = serializers.IntegerField(
        allow_null=True,
    )
    method = serializers.CharField()
    score = serializers.FloatField()
    factors = PriorityFactorSerializer(many=True)


class DurationDefinitionsSerializer(serializers.Serializer):
    decision_duration = serializers.CharField()
    review_duration = serializers.CharField()


class EditorialAnalyticsDashboardSerializer(
    serializers.Serializer
):
    generated_at = serializers.DateTimeField()
    period_months = serializers.IntegerField()
    summary = EditorialAnalyticsSummarySerializer()
    status_distribution = (
        AnalyticsStatusCountSerializer(many=True)
    )
    submissions_over_time = (
        AnalyticsTimePointSerializer(many=True)
    )
    publications_over_time = (
        AnalyticsTimePointSerializer(many=True)
    )
    section_distribution = (
        AnalyticsSectionCountSerializer(many=True)
    )
    topic_distribution = (
        AnalyticsTopicDistributionSerializer()
    )
    overdue_work = AnalyticsOverdueWorkSerializer()
    priority_queue = PriorityQueueItemSerializer(many=True)
    duration_definitions = DurationDefinitionsSerializer()