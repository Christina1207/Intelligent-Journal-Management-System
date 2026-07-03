from django.contrib import admin

from .models import PublishedArticle


@admin.register(PublishedArticle)
class PublishedArticleAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "section",
        "source_version",
        "status",
        "published_at",
        "created_at",
        "updated_at",
    ]
    list_filter = ["status", "section", "published_at"]
    search_fields = ["title", "abstract", "doi", "slug"]
    readonly_fields = ["id", "created_at", "updated_at", "view_count", "download_count"]
    raw_id_fields = ["submission", "source_version", "section"]
