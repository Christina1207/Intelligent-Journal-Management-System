from django.db.models import F
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.submissions.models import Submission

from .models import PublishedArticle
from .serializers import (
    PublishedArticleManagementReadSerializer,
    PublishedArticlePublicDetailSerializer,
    PublishedArticlePublicListSerializer,
    PublishedArticleWriteSerializer,
)
from .services import PublishingService


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

    def post(self, request, submission_id):
        submission = get_object_or_404(
            Submission.objects.select_related("section"),
            pk=submission_id,
        )
        article = PublishingService.create_draft_from_submission(submission)
        return Response(
            PublishedArticleManagementReadSerializer(article).data,
            status=status.HTTP_201_CREATED,
        )


class ArticleManagementListView(generics.ListAPIView):
    permission_classes = [IsPublishingStaffPlaceholder]
    serializer_class = PublishedArticleManagementReadSerializer

    def get_queryset(self):
        return PublishedArticle.objects.select_related("section", "submission")


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

    def post(self, request, article_id):
        article = get_object_or_404(PublishedArticle, pk=article_id)
        article = PublishingService.publish_article(article)
        return Response(PublishedArticleManagementReadSerializer(article).data)


class PublicArticleListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublishedArticlePublicListSerializer

    def get_queryset(self):
        return PublishedArticle.objects.filter(
            status=PublishedArticle.Status.PUBLISHED,
        ).select_related("section")


class PublicSectionArticleListView(PublicArticleListView):
    def get_queryset(self):
        return super().get_queryset().filter(section_id=self.kwargs["section_id"])


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
