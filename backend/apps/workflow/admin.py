from django.contrib import admin
from .models import SubmissionAssignment


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