import uuid
from django.db.models import F
from django.db.models import Q
from django.shortcuts import get_object_or_404
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
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.submissions.models import Submission

from .models import PublishedArticle
from .serializers import (
    PublishedArticleDownloadSerializer,
    PublishedArticleManagementReadSerializer,
    PublishedArticlePublicDetailSerializer,
    PublishedArticlePublicListSerializer,
    PublishedArticleWriteSerializer,
)
from .services import PublicDownloadUnavailable, PublishingService


PUBLIC_ARTICLE_ORDERING_FIELDS = {
    "published_at": "published_at",
    "-published_at": "-published_at",
    "title": "title",
    "-title": "-title",
    "view_count": "view_count",
    "-view_count": "-view_count",
    "download_count": "download_count",
    "-download_count": "-download_count",
}

PUBLIC_ARTICLE_LIST_PARAMETERS = [
    OpenApiParameter(
        name="section",
        type=OpenApiTypes.UUID,
        location=OpenApiParameter.QUERY,
        required=False,
        description="Filter published articles by section id.",
    ),
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
]


class IsPublishingStaffPlaceholder(BasePermission):
    """
    TODO: Replace with role-based publishing permissions for admins,
    editors-in-chief, section managers, section editors, and copyeditors.
    """

    message = "Authentication is required for publishing management."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class CreateArticleDraftView(APIView):
    permission_classes = [IsPublishingStaffPlaceholder]

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
        submission = get_object_or_404(
            Submission.objects.select_related("section"),
            pk=submission_id,
        )
        article = PublishingService.create_draft_from_submission(editor=request.user, submission=submission)
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
    permission_classes = [IsPublishingStaffPlaceholder]
    serializer_class = PublishedArticleManagementReadSerializer

    def get_queryset(self):
        return PublishedArticle.objects.select_related("section", "submission")


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
    permission_classes = [IsPublishingStaffPlaceholder]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    lookup_url_kwarg = "article_id"
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        return PublishedArticle.objects.select_related("section", "submission")

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
    permission_classes = [IsPublishingStaffPlaceholder]

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
        article = get_object_or_404(PublishedArticle, pk=article_id)
        article = PublishingService.publish_article(article)
        return Response(PublishedArticleManagementReadSerializer(article).data)


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

    def get_queryset(self):
        queryset = PublishedArticle.objects.filter(
            status=PublishedArticle.Status.PUBLISHED,
        ).select_related("section")

        section_id = self.request.query_params.get("section")
        if section_id:
            try:
                uuid.UUID(section_id)
            except (TypeError, ValueError):
                raise ValidationError({"section": "Invalid section id."})
            queryset = queryset.filter(section_id=section_id)

        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(abstract__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
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
        return PublishedArticle.objects.filter(
            status=PublishedArticle.Status.PUBLISHED,
        ).select_related("section")

    def retrieve(self, request, *args, **kwargs):
        article = self.get_object()
        PublishedArticle.objects.filter(pk=article.pk).update(
            view_count=F("view_count") + 1,
        )
        article.refresh_from_db(fields=["view_count"])
        return Response(self.get_serializer(article).data)


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
