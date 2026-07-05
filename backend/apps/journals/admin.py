from django.contrib import admin
from .models import Section


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["name", "issn", "manager", "is_active", "created_at", "last_clustered_at"]
    list_filter = ["is_active","manager"]
    search_fields = ["name", "issn", "manager__email", "manager__first_name", "manager__last_name"]
    readonly_fields = ["last_clustered_at"]
    ordering = ["name"]
    autocomplete_fields = ["manager"]