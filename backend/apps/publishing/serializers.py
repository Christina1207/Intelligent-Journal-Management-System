from rest_framework import serializers

from .models import PublishedArticle


class PublishedArticlePublicListSerializer(serializers.ModelSerializer):
    section_id = serializers.UUIDField(source="section.id", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = PublishedArticle
        fields = [
            "id",
            "title",
            "slug",
            "abstract",
            "section_id",
            "section_name",
            "published_at",
            "view_count",
            "download_count",
        ]
        read_only_fields = fields


class PublishedArticlePublicDetailSerializer(PublishedArticlePublicListSerializer):
    pdf_file = serializers.SerializerMethodField()

    class Meta(PublishedArticlePublicListSerializer.Meta):
        fields = [
            "id",
            "title",
            "slug",
            "abstract",
            "keywords",
            "doi",
            "section_id",
            "section_name",
            "pdf_file",
            "published_at",
            "view_count",
            "download_count",
        ]
        read_only_fields = fields

    def get_pdf_file(self, obj):
        return obj.pdf_file.name if obj.pdf_file else None


class PublishedArticleManagementReadSerializer(PublishedArticlePublicDetailSerializer):
    submission_id = serializers.UUIDField(source="submission.id", read_only=True)

    class Meta(PublishedArticlePublicDetailSerializer.Meta):
        fields = [
            "id",
            "submission_id",
            "title",
            "slug",
            "abstract",
            "keywords",
            "doi",
            "section_id",
            "section_name",
            "pdf_file",
            "status",
            "published_at",
            "view_count",
            "download_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublishedArticleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublishedArticle
        fields = ["title", "abstract", "keywords", "doi", "pdf_file"]
        extra_kwargs = {
            "title": {"required": False},
            "abstract": {"required": False, "allow_blank": True},
            "keywords": {"required": False},
            "doi": {"required": False, "allow_blank": True, "allow_null": True},
            "pdf_file": {"required": False, "allow_null": True},
        }

    def validate_doi(self, value):
        return value or None

    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Keywords must be provided as a list.")
        return value
