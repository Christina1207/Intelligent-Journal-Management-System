from django.contrib import admin

from .models import PublishedArticle, PublishedArticleAuthor


class PublishedArticleAuthorInline(admin.TabularInline):
    model = PublishedArticleAuthor
    extra = 0
    fields = [
        "order",
        "full_name",
        "email",
        "orcid",
        "affiliation",
        "country",
        "is_corresponding",
    ]


@admin.register(PublishedArticle)
class PublishedArticleAdmin(admin.ModelAdmin):
    inlines = [PublishedArticleAuthorInline]
    list_display = [
        "title",
        "section",
        "language",
        "volume",
        "issue",
        "doi",
        "source_version",
        "status",
        "published_at",
        "created_at",
        "updated_at",
    ]
    list_filter = ["status", "section", "language", "published_at"]
    search_fields = ["title", "abstract", "doi", "slug"]
    readonly_fields = [
        "id",
        "metadata_updated_at",
        "created_at",
        "updated_at",
        "view_count",
        "download_count",
    ]
    raw_id_fields = ["submission", "source_version", "section"]
    fieldsets = [
        (
            "Source",
            {
                "fields": [
                    "id",
                    "submission",
                    "source_version",
                    "section",
                    "status",
                    "published_at",
                ]
            },
        ),
        (
            "Publication Metadata",
            {
                "fields": [
                    "title",
                    "slug",
                    "abstract",
                    "language",
                    "keywords",
                    "doi",
                    "license_name",
                    "license_url",
                    "volume",
                    "issue",
                    "first_page",
                    "last_page",
                    "pdf_file",
                ]
            },
        ),
        (
            "Counters and Audit",
            {
                "fields": [
                    "view_count",
                    "download_count",
                    "metadata_updated_at",
                    "created_at",
                    "updated_at",
                ]
            },
        ),
    ]
