from django.contrib import admin
from .models import Submission , SubmissionVersion


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "section", "status", "language", "submitted_at"]
    list_filter = ["status", "language", "section"]
    search_fields = ["title", "abstract", "author__username", "author__email"]
    ordering = ["-submitted_at"]
    readonly_fields = ["id", "submitted_at"]

@admin.register(SubmissionVersion)
class SubmissionVersionAdmin(admin.ModelAdmin):
    list_display  = ['id', 'submission', 'version_number', 'decision', 'decided_by', 'decided_at', 'submitted_at']
    list_filter   = ['decision']
    search_fields = ['submission__title', 'submission__author__username']
    raw_id_fields = ['submission', 'decided_by']