from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name"]
    ordering = ["name"]


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ["username", "email", "first_name", "last_name", "status", "is_staff"]
    list_filter = ["status", "is_staff", "roles"]
    search_fields = ["username", "email", "first_name", "last_name", "orcid"]
    ordering = ["username"]

    # Extend the base fieldsets to include our custom fields
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Profile",
            {
                "fields": ("orcid", "affiliation", "country", "status", "roles"),
            },
        ),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "Profile",
            {
                "fields": ("email", "first_name", "last_name", "orcid", "affiliation", "country", "status", "roles"),
            },
        ),
    )