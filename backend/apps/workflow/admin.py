from django.contrib import admin
from .models import SubmissionAssignment
from .models import ReviewerAssignment


@admin.register(SubmissionAssignment)
class SubmissionAssignmentAdmin(admin.ModelAdmin):
    list_display = ["submission", "assigned_to", "assigned_by", "role", "created_at"]
    list_filter = ["role"]
    search_fields = [
        "submission__title",
        "assigned_to__username",
        "assigned_by__username",
    ]
    ordering = ["-created_at"]
    readonly_fields = ["id", "created_at"]


@admin.register(ReviewerAssignment)
class ReviewerAssignmentAdmin(admin.ModelAdmin):
    list_display  = ['id', 'version', 'reviewer', 'assigned_by', 'carried_from', 'status', 'response_deadline', 'review_deadline', 'assigned_at']
    list_filter   = ['status']
    raw_id_fields = ['version', 'reviewer', 'assigned_by', 'carried_from']