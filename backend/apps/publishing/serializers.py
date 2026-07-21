from typing import Optional

from django.urls import reverse
from rest_framework import serializers

from apps.journals.models import Issue, JournalMetadataSettings, Section

from .models import PublishedArticle, PublishedArticleAuthor


class PublicJournalSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="journal_title", read_only=True)
    publisher = serializers.CharField(source="publisher_name", read_only=True)
    issn = serializers.SerializerMethodField()
    license = serializers.SerializerMethodField()

    class Meta:
        model = JournalMetadataSettings
        fields = [
            "name",
            "short_name",
            "description",
            "issn",
            "publisher",
            "access_policy",
            "peer_review_policy",
            "publication_frequency",
            "license",
        ]
        read_only_fields = fields

    def get_issn(self, obj) -> str:
        return obj.online_issn or obj.print_issn or ""

    def get_license(self, obj) -> str:
        return obj.default_license_name or ""


class PublicSectionSerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(read_only=True)
    topics = serializers.SerializerMethodField()

    class Meta:
        model = Section
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "article_count",
            "topics",
        ]
        read_only_fields = fields

    def get_topics(self, obj) -> list[str]:
        # Future extension point:
        # Once section topic labels are formalized, expose them here.
        return []


class PublicIssueSerializer(serializers.ModelSerializer):
    issue = serializers.CharField(source="number", read_only=True)
    year = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            "id",
            "slug",
            "title",
            "volume",
            "issue",
            "year",
            "published_at",
            "description",
            "is_current",
        ]
        read_only_fields = fields

    def get_year(self, obj) -> str:
        return str(obj.year)


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
    # Frontend-friendly aliases
    authors = serializers.SerializerMethodField()
    section = serializers.CharField(source="section.name", read_only=True)
    section_slug = serializers.CharField(source="section.slug", read_only=True)
    views = serializers.IntegerField(source="view_count", read_only=True)
    downloads = serializers.IntegerField(source="download_count", read_only=True)
    license = serializers.SerializerMethodField()
    pages = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    issue_slug = serializers.SerializerMethodField()
    affiliations = serializers.SerializerMethodField()
    volume = serializers.SerializerMethodField()
    issue = serializers.SerializerMethodField()
    received_at = serializers.SerializerMethodField()
    accepted_at = serializers.SerializerMethodField()

    # Backward-compatible backend fields
    section_id = serializers.UUIDField(source="section.id", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = PublishedArticle
        fields = [
            "id",
            "title",
            "slug",
            "authors",
            "section",
            "section_slug",
            "section_id",
            "section_name",
            "published_at",
            "abstract",
            "keywords",
            "doi",
            "language",
            "pdf_url",
            "download_url",
            "views",
            "downloads",
            "view_count",
            "download_count",
            "license",
            "license_name",
            "license_url",
            "volume",
            "issue",
            "issue_slug",
            "pages",
            "received_at",
            "accepted_at",
            "affiliations",
        ]
        read_only_fields = fields

    def get_authors(self, obj) -> list[str]:
        return [author.full_name for author in obj.authors.all() if author.full_name]

    def get_affiliations(self, obj) -> list[str]:
        affiliations = []
        seen = set()

        for author in obj.authors.all():
            affiliation = (author.affiliation or "").strip()
            if not affiliation or affiliation in seen:
                continue

            seen.add(affiliation)
            affiliations.append(affiliation)

        return affiliations

    def get_license(self, obj) -> str:
        return obj.license_name or ""

    def get_volume(self, obj) -> Optional[str]:
        if obj.publication_issue_id and obj.publication_issue:
            return obj.publication_issue.volume or None

        return obj.volume or None

    def get_issue(self, obj) -> Optional[str]:
        if obj.publication_issue_id and obj.publication_issue:
            return obj.publication_issue.number or None

        return obj.issue or None

    def get_issue_slug(self, obj) -> Optional[str]:
        if obj.publication_issue_id and obj.publication_issue:
            return obj.publication_issue.slug

        return None

    def get_pages(self, obj) -> Optional[str]:
        first_page = (obj.first_page or "").strip()
        last_page = (obj.last_page or "").strip()

        if first_page and last_page:
            if first_page == last_page:
                return first_page

            return f"{first_page}-{last_page}"

        return first_page or last_page or None

    def get_download_url(self, obj) -> str:
        path = reverse("public-article-download", kwargs={"slug": obj.slug})
        request = self.context.get("request")

        if request:
            return request.build_absolute_uri(path)

        return path

    def get_pdf_url(self, obj) -> str:
        # The public API should not expose raw storage paths directly.
        # Reader downloads go through the controlled download endpoint.
        return self.get_download_url(obj)

    def get_received_at(self, obj) -> Optional[str]:
        submission = getattr(obj, "submission", None)
        value = getattr(submission, "submitted_at", None) or getattr(
            submission,
            "created_at",
            None,
        )

        return value.isoformat() if value else None

    def get_accepted_at(self, obj) -> Optional[str]:
        source_version = getattr(obj, "source_version", None)
        value = getattr(source_version, "decision_at", None) or getattr(
            source_version,
            "updated_at",
            None,
        )

        return value.isoformat() if value else None


class PublishedArticlePublicDetailSerializer(
    PublishedArticlePublicListSerializer
):
    author_details = PublishedArticleAuthorPublicSerializer(
        source="authors",
        many=True,
        read_only=True,
    )

    class Meta(PublishedArticlePublicListSerializer.Meta):
        fields = [
            *PublishedArticlePublicListSerializer.Meta.fields,
            "author_details",
            "first_page",
            "last_page",
        ]
        read_only_fields = fields


class PublishedArticleManagementReadSerializer(PublishedArticlePublicDetailSerializer):
    authors = PublishedArticleAuthorManagementSerializer(many=True, read_only=True)
    submission_id = serializers.UUIDField(source="submission.id", read_only=True)
    source_version = serializers.PrimaryKeyRelatedField(read_only=True)
    publication_issue = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta(PublishedArticlePublicDetailSerializer.Meta):
        fields = [
            "id",
            "submission_id",
            "source_version",
            "publication_issue",
            "title",
            "slug",
            "abstract",
            "authors",
            "author_details",
            "language",
            "keywords",
            "doi",
            "license",
            "license_name",
            "license_url",
            "volume",
            "issue",
            "issue_slug",
            "first_page",
            "last_page",
            "pages",
            "section",
            "section_slug",
            "section_id",
            "section_name",
            "pdf_file",
            "pdf_url",
            "download_url",
            "status",
            "published_at",
            "views",
            "downloads",
            "view_count",
            "download_count",
            "received_at",
            "accepted_at",
            "affiliations",
            "metadata_updated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class PublishedArticleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublishedArticle
        fields = [
            "publication_issue",
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
        ]
        extra_kwargs = {
            "publication_issue": {"required": False, "allow_null": True},
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
        }

    def validate(self, attrs):
        errors = {}

        if "pdf_file" in self.initial_data:
            errors["pdf_file"] = (
                "The article PDF is sourced from the accepted "
                "submission version and cannot be replaced through "
                "the metadata endpoint."
            )

        if (
            self.instance is not None
            and self.instance.status
            == PublishedArticle.Status.PUBLISHED
            and "publication_issue" in attrs
        ):
            publication_issue = attrs["publication_issue"]

            if publication_issue is None:
                errors["publication_issue"] = (
                    "A published article must remain assigned to a "
                    "published issue."
                )
            elif publication_issue.status != Issue.Status.PUBLISHED:
                errors["publication_issue"] = (
                    "A published article can only be moved to an "
                    "issue with status 'published'."
                )

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def validate_doi(self, value):
        return value or None

    def validate_keywords(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Keywords must be provided as a list.")

        return value
    
    def update(self, instance, validated_data):
        article = super().update(instance, validated_data)

        if article.publication_issue_id:
            publication_issue = article.publication_issue
            changed_fields = []

            if article.volume != publication_issue.volume:
                article.volume = publication_issue.volume
                changed_fields.append("volume")

            if article.issue != publication_issue.number:
                article.issue = publication_issue.number
                changed_fields.append("issue")

            if changed_fields:
                article.save(
                    update_fields=[
                        *changed_fields,
                        "updated_at",
                    ]
                )

        return article


class PublishedArticleDownloadSerializer(serializers.Serializer):
    download_url = serializers.URLField(read_only=True)
    expires_in = serializers.IntegerField(read_only=True)