from rest_framework import status, generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.models import Role, User
from apps.submissions.models import Submission
from apps.submissions.serializers import SubmissionListSerializer
from apps.core.storage import StorageService
from .models import SubmissionAssignment, TriageAssessment
from .serializers import (
    AssignEditorSerializer,
    DeskRejectSerializer,
    ReassignEditorSerializer,
    SubmissionAssignmentSerializer,
    TriageAssessmentDetailSerializer,
    TriageUpdateSerializer,
    EligibleSectionEditorSerializer,
    ManagerMonitoringSubmissionSerializer,
    ManagerManuscriptDownloadSerializer,
    ManagerSubmissionDetailSerializer,
)
from .services import AssignmentService, TriageService
from .permissions import IsSectionManager
from .selectors import (
    MANAGER_MONITORED_STATUSES,
    active_submissions_for_editor,
    eligible_section_editors_for,
    monitored_submissions_for_manager,
    submissions_managed_by,
)



class IsSectionEditor(BasePermission):
    message = "Only section editors can access this endpoint."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_role(Role.RoleName.SECTION_EDITOR)
        )


class ManagerQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSectionManager]
    serializer_class = SubmissionListSerializer

    def get_queryset(self):
        return (
            submissions_managed_by(self.request.user)
            .filter(status=Submission.Status.SUBMITTED)
            .select_related("section", "author")
            .order_by("-submitted_at")
        )

class AssignEditorView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]
    @extend_schema(
        request=AssignEditorSerializer,
        responses={
            201: SubmissionAssignmentSerializer,
        },
        summary="Assign a Section Editor",
        description=(
            "Assign an eligible Section Editor to a submitted manuscript "
            "belonging to a section managed by the authenticated user."
        ),
    )
    def post(self, request, submission_id):
        serializer = AssignEditorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = get_object_or_404(
            submissions_managed_by(request.user).select_related(
                "section",
                "author",
                "assigned_editor",
            ),
            id=submission_id,
        )

        assignment = AssignmentService.assign_editor(
            submission=submission,
            editor=serializer.validated_data["editor"],
            assigned_by=request.user,
        )

        return Response(
            SubmissionAssignmentSerializer(
                assignment,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class EditorQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSectionEditor]
    serializer_class = SubmissionListSerializer

    def get_queryset(self):
        return active_submissions_for_editor(
            self.request.user
        ).select_related("section", "author").order_by("-submitted_at")
    
def get_managed_submission_or_404(request, submission_id):
    return get_object_or_404(
        submissions_managed_by(request.user).select_related(
            "section",
            "author",
            "assigned_editor",
        ),
        id=submission_id,
    )

class ManagerSubmissionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        responses={
            200: ManagerSubmissionDetailSerializer,
        },
        summary="Get a managed manuscript for initial triage",
        description=(
            "Return the manuscript metadata required by a Section "
            "Manager during initial triage. The private storage object "
            "path is never exposed."
        ),
    )
    def get(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        return Response(
            ManagerSubmissionDetailSerializer(submission).data,
            status=status.HTTP_200_OK,
        )


class ManagerManuscriptDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        responses={
            200: ManagerManuscriptDownloadSerializer,
        },
        summary="Get a temporary manuscript download URL",
        description=(
            "Generate a short-lived presigned URL for the latest "
            "manuscript version. The MinIO object path is not returned."
        ),
    )
    def get(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        latest_version = (
            submission.versions
            .order_by("-version_number")
            .first()
        )

        if latest_version is None:
            raise ValidationError(
                {
                    "manuscript": (
                        "The submission has no manuscript version."
                    )
                }
            )

        if not latest_version.file:
            raise ValidationError(
                {
                    "manuscript": (
                        "No manuscript file is attached to the "
                        "latest submission version."
                    )
                }
            )

        expires_in_seconds = 600

        manuscript_url = StorageService().get_public_url(
            object_name=latest_version.file,
            expires_in_seconds=expires_in_seconds,
        )

        response_data = {
            "submission_id": str(submission.id),
            "version_id": str(latest_version.id),
            "version_number": latest_version.version_number,
            "expires_in_seconds": expires_in_seconds,
            "manuscript_url": manuscript_url,
        }

        return Response(
            ManagerManuscriptDownloadSerializer(
                response_data
            ).data,
            status=status.HTTP_200_OK,
        )

class EligibleSectionEditorListView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        responses={
            200: EligibleSectionEditorSerializer(many=True),
        },
        summary="List eligible Section Editors",
        description=(
            "List active Section Editors eligible for this manuscript's "
            "section, ordered by active assignment workload."
        ),
    )
    def get(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        editors = eligible_section_editors_for(submission)

        serializer = EligibleSectionEditorSerializer(
            editors,
            many=True,
            context={
                "request": request,
                "submission": submission,
            },
        )

        return Response(serializer.data)

class ReassignEditorView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        request=ReassignEditorSerializer,
        responses={201: SubmissionAssignmentSerializer},
        summary="Reassign a Section Editor",
        description=(
            "Replace the current Section Editor while preserving "
            "the previous assignment as history."
        ),
    )
    def post(self, request, submission_id):
        serializer = ReassignEditorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        assignment = AssignmentService.reassign_editor(
            submission=submission,
            editor=serializer.validated_data["editor"],
            assigned_by=request.user,
            reason=serializer.validated_data["reason"],
        )

        return Response(
            SubmissionAssignmentSerializer(
                assignment,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

class TriageAssessmentView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        responses={200: TriageAssessmentDetailSerializer},
        summary="Get initial triage assessment",
    )
    def get(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )
        version = (
            submission.versions.order_by("-version_number").first()
        )

        if version is None:
            raise ValidationError(
                {"submission": "The submission has no manuscript version."}
            )

        assessment = (
            TriageAssessment.objects.select_related(
                "submission_version",
                "completed_by",
            )
            .filter(submission_version=version)
            .first()
        )

        if assessment is None:
            assessment = TriageAssessment(
                submission_version=version,
                created_by=request.user,
            )

        return Response(
            TriageAssessmentDetailSerializer(assessment).data
        )

    @extend_schema(
        request=TriageUpdateSerializer,
        responses={200: TriageAssessmentDetailSerializer},
        summary="Save initial triage draft",
    )
    def patch(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        serializer = TriageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assessment = TriageService.update_draft(
            submission=submission,
            manager=request.user,
            internal_notes=serializer.validated_data.get(
                "internal_notes"
            ),
            checks=serializer.validated_data.get("checks", []),
        )

        return Response(
            TriageAssessmentDetailSerializer(assessment).data
        )


class CompleteTriageView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        request=None,
        responses={200: TriageAssessmentDetailSerializer},
        summary="Complete triage for editor assignment",
    )
    def post(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        assessment = TriageService.complete_for_assignment(
            submission=submission,
            manager=request.user,
        )

        return Response(
            TriageAssessmentDetailSerializer(assessment).data
        )


class DeskRejectSubmissionView(APIView):
    permission_classes = [IsAuthenticated, IsSectionManager]

    @extend_schema(
        request=DeskRejectSerializer,
        responses={200: TriageAssessmentDetailSerializer},
        summary="Desk reject a submitted manuscript",
    )
    def post(self, request, submission_id):
        submission = get_managed_submission_or_404(
            request,
            submission_id,
        )

        serializer = DeskRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assessment = TriageService.desk_reject(
            submission=submission,
            manager=request.user,
            reason_code=serializer.validated_data["reason_code"],
            author_message=serializer.validated_data[
                "author_message"
            ],
        )

        return Response(
            TriageAssessmentDetailSerializer(assessment).data
        )

class ManagerMonitoringQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsSectionManager]
    serializer_class = ManagerMonitoringSubmissionSerializer

    def get_queryset(self):
        queryset = monitored_submissions_for_manager(
            self.request.user
        )

        requested_status = self.request.query_params.get("status")

        if requested_status:
            if requested_status not in MANAGER_MONITORED_STATUSES:
                raise ValidationError(
                    {
                        "status": (
                            "Select a valid monitored manuscript status."
                        )
                    }
                )

            queryset = queryset.filter(status=requested_status)

        return queryset

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="status",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=list(MANAGER_MONITORED_STATUSES),
                description=(
                    "Optionally filter manuscripts by workflow status."
                ),
            )
        ],
        responses={
            200: ManagerMonitoringSubmissionSerializer(many=True),
        },
        summary="Monitor active manuscripts",
        description=(
            "List active manuscripts in sections managed by the "
            "authenticated Section Manager, including reviewer progress "
            "and attention flags."
        ),
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)