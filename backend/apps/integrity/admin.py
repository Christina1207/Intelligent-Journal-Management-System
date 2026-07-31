from django.contrib import admin

from .models import PlagiarismScreening


@admin.register(PlagiarismScreening)
class PlagiarismScreeningAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "submission_version",
        "status",
        "source_type",
        "requested_by",
        "created_at",
        "completed_at",
    ]
    list_filter = [
        "status",
        "source_type",
        "pipeline_version",
        "created_at",
    ]
    search_fields = [
        "id",
        "submission_version__submission__title",
        "celery_task_id",
        "checkpoint_id",
        "error_code",
        "requested_by__username",
        "requested_by__email",
    ]
    list_select_related = [
        "submission_version__submission",
        "requested_by",
    ]
    date_hierarchy = "created_at"
    ordering = ["-created_at"]

    readonly_fields = [
        "id",
        "submission_version",
        "status",
        "requested_by",
        "celery_task_id",
        "source_type",
        "pipeline_version",
        "checkpoint_id",
        "report_schema_version",
        "summary",
        "report",
        "error_code",
        "error_message",
        "created_at",
        "started_at",
        "updated_at",
        "completed_at",
    ]

    fieldsets = [
        (
            "Screening",
            {
                "fields": [
                    "id",
                    "submission_version",
                    "status",
                    "requested_by",
                    "celery_task_id",
                ]
            },
        ),
        (
            "Pipeline identity",
            {
                "fields": [
                    "source_type",
                    "pipeline_version",
                    "checkpoint_id",
                    "report_schema_version",
                ]
            },
        ),
        (
            "Result",
            {
                "fields": [
                    "summary",
                    "report",
                    "error_code",
                    "error_message",
                ]
            },
        ),
        (
            "Timestamps",
            {
                "fields": [
                    "created_at",
                    "started_at",
                    "updated_at",
                    "completed_at",
                ]
            },
        ),
    ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False