import uuid
from django.db.models import Count, F, Q
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_slug
from django.http import HttpResponse,Http404
from django.shortcuts import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from apps.journals.models import Issue, JournalMetadataSettings, Section
from drf_spectacular.utils import (
    OpenApiExample,
    OpenApiParameter,
    OpenApiResponse,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
)
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.submissions.permissions import filter_submissions_for_user

from .permissions import CanPublishArticle, IsPublishingStaff
from .selectors import publishing_records_for
from apps.submissions.models import Submission

from .exporters import (
    FORMAT_ALIASES,
    normalize_export_format,
    render_bibtex,
    render_dublin_core_xml,
    render_ris,
)
from .metadata import ArticleMetadataBuilder
from .models import PublishedArticle
from .serializers import (
    PublicIssueSerializer,
    PublicJournalSerializer,
    PublicSectionSerializer,
    PublishedArticleDownloadSerializer,
    PublishedArticleManagementReadSerializer,
    PublishedArticlePublicDetailSerializer,
    PublishedArticlePublicListSerializer,
    PublishedArticleWriteSerializer,
)
from .services import PublicDownloadUnavailable, PublishingService

class PublicReaderPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50

PUBLIC_ARTICLE_ORDERING_FIELDS = {
    "published_at": "published_at",
    "-published_at": "-published_at",
    "title": "title",
    "-title": "-title",
    "view_count": "view_count",
    "-view_count": "-view_count",
    "download_count": "download_count",
    "-download_count": "-download_count",
    "views": "view_count",
    "-views": "-view_count",
    "downloads": "download_count",
    "-downloads": "-download_count",
}

PUBLIC_ARTICLE_LIST_PARAMETERS = [
    OpenApiParameter(
        name="section",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter published articles by section slug or section UUID.",
    ),
    OpenApiParameter(
        name="issue",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter published articles by issue slug.",
    ),
    OpenApiParameter(
        name="year",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter published articles by publication year.",
    ),
    OpenApiParameter(
        name="language",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter published articles by language code.",
    ),
    OpenApiParameter(
        name="search",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Search published article titles, abstracts, DOI, and author names.",
    ),
    OpenApiParameter(
        name="ordering",
        type=OpenApiTypes.STR,
        location=OpenApiParameter.QUERY,
        required=False,
        enum=list(PUBLIC_ARTICLE_ORDERING_FIELDS.keys()),
        description="Order published articles by a supported public field.",
    ),
    OpenApiParameter(
        name="page_size",
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Number of results per page. Maximum: 50.",
    ),
]
ARTICLE_EXPORT_PARAMETER = OpenApiParameter(
    name="format",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=True,
    enum=list(FORMAT_ALIASES.keys()),
    description=(
        "Metadata export format. Supported aliases: bibtex, bib, ris, dc, "
        "dublin-core, dublin_core, xml."
    ),
)

ARTICLE_EXPORT_CONTENT = {
    "bibtex": {
        "renderer": render_bibtex,
        "content_type": "application/x-bibtex; charset=utf-8",
        "extension": "bib",
    },
    "ris": {
        "renderer": render_ris,
        "content_type": "application/x-research-info-systems; charset=utf-8",
        "extension": "ris",
    },
    "dc": {
        "renderer": render_dublin_core_xml,
        "content_type": "application/xml; charset=utf-8",
        "extension": "xml",
    },
}


class IgnoreFormatQueryContentNegotiation(BaseContentNegotiation):
    """
    DRF reserves ?format= for renderer selection. The citation export endpoint
    uses it as domain input, so negotiation must not consume it first.
    """

    def select_parser(self, request, parsers):
        return parsers[0] if parsers else None

    def select_renderer(self, request, renderers, format_suffix=None):
        renderer = renderers[0]
        return renderer, renderer.media_type


class CreateArticleDraftView(APIView):
    permission_classes = [IsPublishingStaff]

    @extend_schema(
        tags=["Publishing"],
        request=None,
        responses={
            201: PublishedArticleManagementReadSerializer,
            400: OpenApiResponse(
                description=(
                    "The submission is not accepted, already has a publication "
                    "record, or has no publishable accepted version/file."
                )
            ),
            401: OpenApiResponse(description="Authentication credentials were not provided."),
            404: OpenApiResponse(description="Submission was not found."),
        },
        description="Create a publication draft from an accepted submission.",
    )
    def post(self, request, submission_id):
        accessible_submissions = filter_submissions_for_user(
            Submission.objects.select_related(
                "section",
                "author",
                "assigned_editor",
            ),
            request.user,
        )
        submission = get_object_or_404(
            accessible_submissions,
            pk=submission_id,
        )
        article = PublishingService.create_draft_from_submission(
            actor=request.user,
            submission=submission,
        )
        return Response(
            PublishedArticleManagementReadSerializer(article).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    get=extend_schema(
        tags=["Publishing"],
        responses={200: PublishedArticleManagementReadSerializer(many=True)},
        description=(
            "List publication drafts and published article records for publishing staff."
        ),
    )
)
class ArticleManagementListView(generics.ListAPIView):
    permission_classes = [IsPublishingStaff]
    serializer_class = PublishedArticleManagementReadSerializer

    def get_queryset(self):
        return publishing_records_for(self.request.user)


@extend_schema_view(
    get=extend_schema(
        tags=["Publishing"],
        responses={200: PublishedArticleManagementReadSerializer},
        description="Retrieve one publication record for publishing staff.",
    ),
    patch=extend_schema(
        tags=["Publishing"],
        request=PublishedArticleWriteSerializer,
        responses={200: PublishedArticleManagementReadSerializer},
        description=(
            "Update editable publication metadata. Article status is workflow-managed "
            "and cannot be changed through this endpoint."
        ),
    ),
)
class ArticleManagementDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsPublishingStaff]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_url_kwarg = "article_id"
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return publishing_records_for(self.request.user)

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return PublishedArticleWriteSerializer
        return PublishedArticleManagementReadSerializer

    def patch(self, request, *args, **kwargs):
        article = self.get_object()
        serializer = PublishedArticleWriteSerializer(
            article,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        article = serializer.save()
        return Response(PublishedArticleManagementReadSerializer(article).data)


class PublishArticleView(APIView):
    permission_classes = [CanPublishArticle]

    @extend_schema(
        tags=["Publishing"],
        request=None,
        responses={
            200: PublishedArticleManagementReadSerializer,
            400: OpenApiResponse(
                description="The article is already published, retracted, or not a draft."
            ),
            401: OpenApiResponse(description="Authentication credentials were not provided."),
            404: OpenApiResponse(description="Publication record was not found."),
        },
        description="Publish a draft article and set its publication timestamp.",
    )
    def post(self, request, article_id):
        article = get_object_or_404(
            publishing_records_for(request.user),
            pk=article_id,
        )
        article = PublishingService.publish_article(article)
        return Response(PublishedArticleManagementReadSerializer(article).data)

@extend_schema_view(
    get=extend_schema(
        tags=["Public Journal"],
        auth=[],
        responses={200: PublicJournalSerializer},
        description="Retrieve public journal metadata for the reader portal.",
    )
)
class PublicJournalView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicJournalSerializer

    def get_object(self):
        return JournalMetadataSettings.get_current()


@extend_schema_view(
    get=extend_schema(
        tags=["Public Sections"],
        auth=[],
        responses={200: PublicSectionSerializer(many=True)},
        description="List active journal sections visible to public readers.",
    )
)
class PublicSectionListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicSectionSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Section.objects.filter(is_active=True)
            .annotate(
                article_count=Count(
                    "published_articles",
                    filter=Q(
                        published_articles__status=PublishedArticle.Status.PUBLISHED,
                    ),
                )
            )
            .order_by("name")
        )


@extend_schema_view(
    get=extend_schema(
        tags=["Public Sections"],
        auth=[],
        responses={
            200: PublicSectionSerializer,
            404: OpenApiResponse(description="Section was not found."),
        },
        description="Retrieve one public section by slug.",
    )
)
class PublicSectionDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicSectionSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_queryset(self):
        return (
            Section.objects.filter(is_active=True)
            .annotate(
                article_count=Count(
                    "published_articles",
                    filter=Q(
                        published_articles__status=PublishedArticle.Status.PUBLISHED,
                    ),
                )
            )
            .order_by("name")
        )


@extend_schema_view(
    get=extend_schema(
        tags=["Public Issues"],
        auth=[],
        responses={200: PublicIssueSerializer(many=True)},
        description="List published journal issues for the public archive.",
    )
)
class PublicIssueListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIssueSerializer
    pagination_class = None

    def get_queryset(self):
        return Issue.objects.filter(status=Issue.Status.PUBLISHED)


@extend_schema_view(
    get=extend_schema(
        tags=["Public Issues"],
        auth=[],
        responses={
            200: PublicIssueSerializer,
            404: OpenApiResponse(description="No current issue is available."),
        },
        description="Retrieve the current public issue.",
    )
)
class PublicCurrentIssueView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIssueSerializer

    def get_object(self):
        current_issue = Issue.objects.filter(
            status=Issue.Status.PUBLISHED,
            is_current=True,
        ).first()

        if current_issue:
            return current_issue

        latest_issue = (
            Issue.objects.filter(status=Issue.Status.PUBLISHED)
            .order_by(
                F("published_at").desc(nulls_last=True),
                "-year",
                "volume",
                "number",
            )
            .first()
        )

        if latest_issue:
            return latest_issue

        raise Http404("No current issue is available.")


@extend_schema_view(
    get=extend_schema(
        tags=["Public Issues"],
        auth=[],
        responses={
            200: PublicIssueSerializer,
            404: OpenApiResponse(description="Issue was not found."),
        },
        description="Retrieve one published issue by slug.",
    )
)
class PublicIssueDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIssueSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_queryset(self):
        return Issue.objects.filter(status=Issue.Status.PUBLISHED)
@extend_schema_view(
    get=extend_schema(
        tags=["Public Articles"],
        auth=[],
        parameters=PUBLIC_ARTICLE_LIST_PARAMETERS,
        responses={200: PublishedArticlePublicListSerializer(many=True)},
        description=(
            "List publicly published articles. Draft and retracted articles are never "
            "included."
        ),
    )
)
class PublicArticleListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublishedArticlePublicListSerializer
    pagination_class = PublicReaderPagination

    def get_queryset(self):
        queryset = (
            PublishedArticle.objects.filter(
                status=PublishedArticle.Status.PUBLISHED,
            )
            .select_related(
                "section",
                "publication_issue",
                "submission",
                "source_version",
            )
            .prefetch_related("authors")
        )

        section_value = self.request.query_params.get("section", "").strip()
        if section_value:
            try:
                uuid.UUID(section_value)
                queryset = queryset.filter(section_id=section_value)
            except (TypeError, ValueError):
                try:
                    validate_slug(section_value)
                except DjangoValidationError:
                    raise ValidationError(
                        {"section": "Invalid section filter. Use a section UUID or slug."}
                    )

                queryset = queryset.filter(section__slug=section_value)
        issue_slug = self.request.query_params.get("issue", "").strip()
        if issue_slug:
            queryset = queryset.filter(publication_issue__slug=issue_slug)

        year = self.request.query_params.get("year", "").strip()
        if year:
            try:
                year_value = int(year)
            except ValueError:
                raise ValidationError({"year": "Year must be a valid integer."})

            queryset = queryset.filter(
                Q(published_at__year=year_value)
                | Q(publication_issue__year=year_value)
            )

        language = self.request.query_params.get("language", "").strip()
        if language:
            queryset = queryset.filter(language__iexact=language)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(abstract__icontains=search)
                | Q(doi__icontains=search)
                | Q(authors__full_name__icontains=search)
            ).distinct()

        ordering = self.request.query_params.get("ordering", "").strip()
        if ordering:
            try:
                order_by = PUBLIC_ARTICLE_ORDERING_FIELDS[ordering]
            except KeyError:
                allowed_values = ", ".join(PUBLIC_ARTICLE_ORDERING_FIELDS.keys())
                raise ValidationError(
                    {
                        "ordering": (
                            f"Unsupported ordering. Allowed values: {allowed_values}."
                        )
                    }
                )

            queryset = queryset.order_by(order_by)

        return queryset

@extend_schema_view(
    get=extend_schema(
        tags=["Public Articles"],
        auth=[],
        parameters=[
            OpenApiParameter(
                name="search",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Search published article titles and abstracts.",
            ),
            OpenApiParameter(
                name="ordering",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=list(PUBLIC_ARTICLE_ORDERING_FIELDS.keys()),
                description="Order published articles by a supported public field.",
            ),
        ],
        responses={200: PublishedArticlePublicListSerializer(many=True)},
        description="List publicly published articles for a specific section.",
    )
)
class PublicSectionArticleListView(PublicArticleListView):
    def get_queryset(self):
        return super().get_queryset().filter(section_id=self.kwargs["section_id"])
@extend_schema_view(
    get=extend_schema(
        tags=["Public Articles"],
        auth=[],
        responses={
            200: PublishedArticlePublicDetailSerializer,
            404: OpenApiResponse(description="Published article was not found."),
        },
        description=(
            "Retrieve one publicly published article by slug and increment its view count."
        ),
    )
)
class PublicArticleDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublishedArticlePublicDetailSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_queryset(self):
        return (
            PublishedArticle.objects.filter(
                status=PublishedArticle.Status.PUBLISHED,
            )
            .select_related(
                "section",
                "publication_issue",
                "submission",
                "source_version",
            )
            .prefetch_related("authors")
        )

    def retrieve(self, request, *args, **kwargs):
        article = self.get_object()
        PublishedArticle.objects.filter(pk=article.pk).update(
            view_count=F("view_count") + 1,
        )
        article.refresh_from_db(fields=["view_count"])
        return Response(self.get_serializer(article).data)


class PublicArticleMetadataExportView(APIView):
    permission_classes = [AllowAny]
    content_negotiation_class = IgnoreFormatQueryContentNegotiation

    @extend_schema(
        tags=["Public Articles"],
        auth=[],
        parameters=[ARTICLE_EXPORT_PARAMETER],
        responses={
            200: OpenApiResponse(
                response=OpenApiTypes.BINARY,
                description=(
                    "Published article metadata file. Content type depends on "
                    "the requested format."
                ),
            ),
            400: OpenApiResponse(description="Missing or unsupported export format."),
            404: OpenApiResponse(description="Published article was not found."),
        },
        description=(
            "Export citation-manager-compatible metadata for a published article. "
            "Draft and retracted articles return 404."
        ),
    )
    def get(self, request, slug):
        export_format = normalize_export_format(request.query_params.get("format"))
        if export_format is None:
            allowed_values = ", ".join(FORMAT_ALIASES.keys())
            raise ValidationError(
                {
                    "format": (
                        "Unsupported export format. "
                        f"Allowed values: {allowed_values}."
                    )
                }
            )

        article = get_object_or_404(
            PublishedArticle.objects.filter(
                status=PublishedArticle.Status.PUBLISHED,
            )
            .select_related("section","publication_issue")
            .prefetch_related("authors"),
            slug=slug,
        )
        metadata = ArticleMetadataBuilder(request=request).build(article)
        export_config = ARTICLE_EXPORT_CONTENT[export_format]
        content = export_config["renderer"](metadata)

        response = HttpResponse(
            content,
            content_type=export_config["content_type"],
        )
        response["Content-Disposition"] = (
            f'attachment; filename="{article.slug}.{export_config["extension"]}"'
        )
        return response


class PublicArticleDownloadView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Public Articles"],
        auth=[],
        responses={
            200: OpenApiResponse(
                response=PublishedArticleDownloadSerializer,
                description="Temporary download URL for the published article PDF.",
                examples=[
                    OpenApiExample(
                        "MinIO presigned URL",
                        value={
                            "download_url": (
                                "https://minio.example.com/ijms/"
                                "submissions/article/v1/manuscript.pdf"
                                "?X-Amz-Signature=..."
                            ),
                            "expires_in": 3600,
                        },
                    )
                ],
            ),
            404: OpenApiResponse(
                description="Published article or downloadable PDF was not found."
            ),
            503: OpenApiResponse(
                description="The article download URL could not be generated."
            ),
        },
        description=(
            "Generate a temporary public download URL for a published article PDF. "
            "Draft and retracted articles return 404."
        ),
    )
    def get(self, request, slug):
        article = get_object_or_404(
            PublishedArticle.objects.filter(status=PublishedArticle.Status.PUBLISHED),
            slug=slug,
        )
        try:
            data = PublishingService.get_public_download_data(article)
        except PublicDownloadUnavailable as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        PublishedArticle.objects.filter(pk=article.pk).update(
            download_count=F("download_count") + 1,
        )
        return Response(data)
