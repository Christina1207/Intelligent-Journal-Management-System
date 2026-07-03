import logging
from rest_framework import status, generics
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.models import Role
from .models import Submission, SubmissionVersion
from .serializers import (
    SubmissionCreateSerializer,
    SubmissionListSerializer,
    SubmissionVersionSerializer,
    RevisionUploadSerializer,
)
from .services import SubmissionService

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
            submission = SubmissionService.create_submission(
                author=request.user,
                validated_data=data,
                file=file,
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


class SubmissionVersionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionVersionSerializer

    def get_queryset(self):
        submission_id = self.kwargs["submission_id"]
        # Authors see only their own submission versions
        # Editors and reviewers access controlled at assignment level
        # TODO Sprint 4: tighten access control with permission engine
        return SubmissionVersion.objects.filter(
            submission__id=submission_id
        ).select_related("decided_by")


class RevisionUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

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
                    review_deadline=serializer.validated_data["review_deadline"],
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