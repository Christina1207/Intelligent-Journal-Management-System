import logging
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status, generics
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.workflow.models import ReviewerAssignment
from apps.accounts.models import Role
from .models import Submission, SubmissionVersion
from .permissions import filter_submissions_for_user
from .serializers import (
    AuthorDashboardSerializer,
    SubmissionCreateSerializer,
    SubmissionDetailSerializer,
    SubmissionListSerializer,
    SubmissionVersionSerializer,
    RevisionUploadSerializer,
)
from .services import AuthorDashboardService, SubmissionService

logger = logging.getLogger(__name__)


class SubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={"multipart/form-data": SubmissionCreateSerializer},
        responses={201: SubmissionListSerializer},
    )
    def post(self, request):
        if not request.user.has_role(Role.RoleName.AUTHOR):
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("Only authors can create submissions.")

        serializer = SubmissionCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            file = data.pop("file")
            blinded_file = data.pop("blinded_file")
            submission = SubmissionService.create_submission(
                author=request.user,
                validated_data=data,
                file=file,
                blinded_file=blinded_file,
            )
            return Response(
                SubmissionListSerializer(submission).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MySubmissionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionListSerializer

    def get_queryset(self):
        return Submission.objects.filter(
            author=self.request.user
        ).select_related("section")


class AuthorDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: AuthorDashboardSerializer},
    )
    def get(self, request):
        if not request.user.has_role(Role.RoleName.AUTHOR):
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("Only authors can view the author dashboard.")

        dashboard = AuthorDashboardService.get_dashboard(request.user)
        return Response(AuthorDashboardSerializer(dashboard).data)


class SubmissionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionDetailSerializer
    lookup_url_kwarg = "submission_id"

    def get_queryset(self):
        queryset = (
            Submission.objects.select_related("section", "topic")
            .prefetch_related(
                Prefetch(
                    "versions",
                    queryset=SubmissionVersion.objects.order_by("-version_number"),
                    to_attr="prefetched_versions",
                )
            )
        )

        return filter_submissions_for_user(queryset, self.request.user)


class SubmissionVersionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionVersionSerializer

    def get_queryset(self):
        submission_id = self.kwargs["submission_id"]

        accessible_submissions = filter_submissions_for_user(
            Submission.objects.all(),
            self.request.user,
        )

        submission = get_object_or_404(
            accessible_submissions,
            id=submission_id,
        )

        return (
            SubmissionVersion.objects.filter(submission=submission)
            .select_related("decided_by")
            .prefetch_related(
                Prefetch(
                    "reviewer_assignments",
                    queryset=(
                        ReviewerAssignment.objects
                        .select_related("review")
                        .order_by("assigned_at", "id")
                    ),
                    to_attr="author_feedback_assignments",
                )
            )
            .order_by("-version_number")
        )


class RevisionUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request={"multipart/form-data": RevisionUploadSerializer},
        responses={201: SubmissionVersionSerializer},
    )
    def post(self, request, submission_id):
        if not request.user.has_role(Role.RoleName.AUTHOR):
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("Only authors can upload revisions.")

        try:
            submission = Submission.objects.get(id=submission_id)
        except Submission.DoesNotExist:
            return Response(
                {"detail": "Submission not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = RevisionUploadSerializer(data=request.data)
        if serializer.is_valid():
            try:
                version = SubmissionService.create_revision(
                    author=request.user,
                    submission=submission,
                    file=serializer.validated_data["file"],
                    blinded_file=serializer.validated_data["blinded_file"],
                    response_to_reviewers=serializer.validated_data.get(
                        "response_to_reviewers",
                        "",
                    ),
                )
                return Response(
                    SubmissionVersionSerializer(version).data,
                    status=status.HTTP_201_CREATED,
                )
            except Exception as e:
                return Response(
                    {"detail": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
