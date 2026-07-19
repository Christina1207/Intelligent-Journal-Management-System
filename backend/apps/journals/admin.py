from django.contrib import admin
from .models import (
    Issue,
    JournalMetadataSettings,
    Section,
    SectionEditorMembership,
)

class SectionEditorMembershipInline(admin.TabularInline):
    model = SectionEditorMembership
    extra = 0
    autocomplete_fields = ["editor", "created_by"]
    fields = [
        "editor",
        "is_active",
        "created_by",
        "created_at",
        "updated_at",
    ]
    readonly_fields = ["created_at", "updated_at"]

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    inlines = [SectionEditorMembershipInline]
    list_display = ["name","slug", "issn", "manager", "is_active", "created_at", "last_clustered_at"]
    list_filter = ["is_active","manager"]
    search_fields = ["name", "slug", "issn", "manager__email", "manager__first_name", "manager__last_name"]
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ["last_clustered_at"]
    ordering = ["name"]
    autocomplete_fields = ["manager"]

@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "slug",
        "volume",
        "number",
        "year",
        "status",
        "is_current",
        "published_at",
    ]
    list_filter = ["status", "is_current", "year", "published_at"]
    search_fields = ["title", "slug", "volume", "number", "description"]
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ["id", "created_at", "updated_at"]

@admin.register(JournalMetadataSettings)
class JournalMetadataSettingsAdmin(admin.ModelAdmin):
    list_display = [
        "journal_title",
        "short_name",
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
                    "short_name",
                    "description",
                    "publisher_name",
                    "logo",
                    "primary_color",
                    "print_issn",
                    "online_issn",
                    "base_url",
                    "default_language",
                ]
            },
        ),
        (
            "Editorial and Access Policies",
            {
                "fields": [
                    "access_policy",
                    "peer_review_policy",
                    "publication_frequency",
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
            "Priority Ranking",
            {
                "description": (
                    "Weights are normalized automatically. They do not "
                    "need to total 100, but at least one must be positive."
                ),
                "fields": [
                    "priority_waiting_age_cap_days",
                    "priority_waiting_age_weight",
                    "priority_action_urgency_weight",
                    "priority_reviewer_shortage_weight",
                    "priority_overdue_work_weight",
                    "priority_revision_round_weight",
                ],
            },
        ),
        (
            "OAI-PMH Metadata",
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
    
    def has_delete_permission(self, request, obj=None):
        return False
    
@admin.register(SectionEditorMembership)
class SectionEditorMembershipAdmin(admin.ModelAdmin):
    list_display = [
        "section",
        "editor",
        "is_active",
        "created_by",
        "created_at",
    ]
    list_filter = ["is_active", "section"]
    search_fields = [
        "section__name",
        "editor__username",
        "editor__email",
        "editor__first_name",
        "editor__last_name",
    ]
    autocomplete_fields = ["section", "editor", "created_by"]
    readonly_fields = ["id", "created_at", "updated_at"]