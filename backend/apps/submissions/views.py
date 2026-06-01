from rest_framework import status, generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role
from .models import Submission
from .serializers import SubmissionCreateSerializer, SubmissionListSerializer
from .services import SubmissionService


class SubmissionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.has_role(Role.RoleName.AUTHOR):
            return Response(
                {"detail": "Only authors can create submissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = SubmissionCreateSerializer(data=request.data)
        if serializer.is_valid():
            submission = SubmissionService.create_submission(
                author=request.user,
                validated_data=serializer.validated_data,
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