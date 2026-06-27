from django.contrib import admin
from .models import Section


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["name", "issn", "is_active", "created_at", "last_clustered_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "issn"]
    readonly_fields = ["last_clustered_at"]
    ordering = ["name"]