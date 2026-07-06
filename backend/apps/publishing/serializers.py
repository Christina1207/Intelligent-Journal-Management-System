from typing import Optional
from rest_framework import serializers
from .models import PublishedArticle, PublishedArticleAuthor


class PublishedArticleAuthorPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublishedArticleAuthor
        fields = [
            "full_name",
            "orcid",
            "affiliation",
            "country",
            "order",
            "is_corresponding",
        ]
        read_only_fields = fields


class PublishedArticleAuthorManagementSerializer(PublishedArticleAuthorPublicSerializer):
    class Meta(PublishedArticleAuthorPublicSerializer.Meta):
        fields = [
            "id",
            "full_name",
            "email",
            "orcid",
            "affiliation",
            "country",
            "order",
            "is_corresponding",
        ]
        read_only_fields = fields


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
    authors = PublishedArticleAuthorPublicSerializer(many=True, read_only=True)
    pdf_file = serializers.SerializerMethodField()

    class Meta(PublishedArticlePublicListSerializer.Meta):
        fields = [
            "id",
            "title",
            "slug",
            "abstract",
            "authors",
            "language",
            "keywords",
            "doi",
            "license_name",
            "license_url",
            "volume",
            "issue",
            "first_page",
            "last_page",
            "section_id",
            "section_name",
            "pdf_file",
            "published_at",
            "view_count",
            "download_count",
        ]
        read_only_fields = fields

    def get_pdf_file(self, obj) -> Optional[str]:
        return obj.pdf_file.name if obj.pdf_file else None


class PublishedArticleManagementReadSerializer(PublishedArticlePublicDetailSerializer):
    authors = PublishedArticleAuthorManagementSerializer(many=True, read_only=True)
    submission_id = serializers.UUIDField(source="submission.id", read_only=True)
    source_version = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(PublishedArticlePublicDetailSerializer.Meta):
        fields = [
            "id",
            "submission_id",
            "source_version",
            "title",
            "slug",
            "abstract",
            "authors",
            "language",
            "keywords",
            "doi",
            "license_name",
            "license_url",
            "volume",
            "issue",
            "first_page",
            "last_page",
            "section_id",
            "section_name",
            "pdf_file",
            "status",
            "published_at",
            "view_count",
            "download_count",
            "metadata_updated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublishedArticleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublishedArticle
        fields = [
            "title",
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
        extra_kwargs = {
            "title": {"required": False},
            "abstract": {"required": False, "allow_blank": True},
            "language": {"required": False, "allow_blank": True},
            "keywords": {"required": False},
            "doi": {"required": False, "allow_blank": True, "allow_null": True},
            "license_name": {"required": False, "allow_blank": True},
            "license_url": {"required": False, "allow_blank": True},
            "volume": {"required": False, "allow_blank": True},
            "issue": {"required": False, "allow_blank": True},
            "first_page": {"required": False, "allow_blank": True},
            "last_page": {"required": False, "allow_blank": True},
            "pdf_file": {"required": False, "allow_null": True},
        }

    def validate_doi(self, value):
        return value or None

    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Keywords must be provided as a list.")
        return value

class PublishedArticleDownloadSerializer(serializers.Serializer):
    download_url = serializers.URLField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)
