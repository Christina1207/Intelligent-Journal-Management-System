from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.shortcuts import get_object_or_404

from apps.accounts.models import Role, User
from apps.submissions.models import Submission
from apps.submissions.serializers import SubmissionListSerializer
from .models import SubmissionAssignment
from .serializers import AssignEditorSerializer, SubmissionAssignmentSerializer
from .services import AssignmentService


class ManagerQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionListSerializer

    def get_queryset(self):
        #TODO:this returns empty for all roles  except section manager , maybe it should show a message instead of empty list for other roles
        # but check if this leaks any information about the submissions to unauthorized users
        if not self.request.user.has_role(Role.RoleName.SECTION_MANAGER):
            return Submission.objects.none()
        
        return Submission.objects.filter(
            status=Submission.Status.SUBMITTED
        ).select_related("section", "author")


class AssignEditorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.has_role(Role.RoleName.SECTION_MANAGER):
            return Response(
                {"detail": "Only section managers can assign editors."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignEditorSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        submission = get_object_or_404(
            Submission,
            id=serializer.validated_data["submission_id"],
        )
        editor = get_object_or_404(
            User,
            id=serializer.validated_data["editor_id"],
        )

        try:
            assignment = AssignmentService.assign_editor(
                submission=submission,
                editor=editor,
                assigned_by=request.user,
            )
        except ValueError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            SubmissionAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class EditorQueueView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionListSerializer

    def get_queryset(self):
        if not self.request.user.has_role(Role.RoleName.SECTION_EDITOR):
            return Submission.objects.none()

        # Get submissions where the latest assignment points to this editor
        assigned_submission_ids = SubmissionAssignment.objects.filter(
            assigned_to=self.request.user,
            role=Role.RoleName.SECTION_EDITOR,
        ).values_list("submission_id", flat=True)

        return Submission.objects.filter(
            id__in=assigned_submission_ids,
            status=Submission.Status.ASSIGNED,
        ).select_related("section", "author")