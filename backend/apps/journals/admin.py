from django.contrib import admin
from .models import JournalMetadataSettings, Section


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["name", "issn", "manager", "is_active", "created_at", "last_clustered_at"]
    list_filter = ["is_active","manager"]
    search_fields = ["name", "issn", "manager__email", "manager__first_name", "manager__last_name"]
    readonly_fields = ["last_clustered_at"]
    ordering = ["name"]
    autocomplete_fields = ["manager"]

@admin.register(JournalMetadataSettings)
class JournalMetadataSettingsAdmin(admin.ModelAdmin):
    list_display = [
        "journal_title",
        "publisher_name",
        "print_issn",
        "online_issn",
        "default_language",
        "updated_at",
    ]
    readonly_fields = ["id", "created_at", "updated_at"]
    fieldsets = [
        (
            "Journal Identity",
            {
                "fields": [
                    "journal_title",
                    "publisher_name",
                    "print_issn",
                    "online_issn",
                    "base_url",
                    "default_language",
                ]
            },
        ),
        (
            "Rights",
            {
                "fields": [
                    "default_license_name",
                    "default_license_url",
                ]
            },
        ),
        (
            "Future OAI Metadata",
            {
                "fields": [
                    "oai_repository_name",
                    "oai_admin_email",
                ]
            },
        ),
        (
            "Audit",
            {
                "fields": [
                    "id",
                    "created_at",
                    "updated_at",
                ]
            },
        ),
    ]

    def has_add_permission(self, request):
        if JournalMetadataSettings.objects.exists():
            return False
        return super().has_add_permission(request)
