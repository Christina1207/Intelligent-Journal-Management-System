from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import ReviewerApplication, ReviewerProfile, Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name"]
    ordering = ["name"]
    readonly_fields = ["name"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(ReviewerApplication)
class ReviewerApplicationAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "section",
        "status",
        "submitted_at",
        "reviewed_at",
        "reviewed_by",
    ]

    list_filter = [
        "status",
        "section",
    ]

    search_fields = [
        "user__username",
        "user__email",
        "user__first_name",
        "user__last_name",
        "section__name",
    ]

    list_select_related = [
        "user",
        "section",
        "reviewed_by",
    ]

    ordering = [
        "-submitted_at",
    ]
    def get_readonly_fields(self, request, obj=None):
        return [
            field.name
            for field in self.model._meta.concrete_fields
        ]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(ReviewerProfile)
class ReviewerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "sync_status", "last_synced_at"]
    list_filter = ["sync_status","sections"]
    search_fields = ["user__email", "user__username","sections__name"]
    readonly_fields = ["expertise_embedding", "last_synced_at", "sync_status", "publications"]
    filter_horizontal = ["sections"]

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = [
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "orcid",
    ]
    list_filter = ["is_active", "is_staff", "roles"]
    search_fields = [
        "username",
        "email",
        "first_name",
        "last_name",
        "orcid",
    ]
    ordering = ["username"]

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "orcid",
                    "affiliation",
                    "country",
                    "roles",
                ),
            },
        ),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Profile",
            {
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "orcid",
                    "affiliation",
                    "country",
                    "roles",
                ),
            },
        ),
    )