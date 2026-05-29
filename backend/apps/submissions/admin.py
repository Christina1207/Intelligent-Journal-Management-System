from django.contrib import admin
from .models import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ["title", "author", "section", "status", "language", "submitted_at"]
    list_filter = ["status", "language", "section"]
    search_fields = ["title", "abstract", "author__username", "author__email"]
    ordering = ["-submitted_at"]
    readonly_fields = ["id", "submitted_at"]