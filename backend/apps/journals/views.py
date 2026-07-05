from rest_framework import generics,status,viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Section
from .serializers import SectionSerializer
from .permissions import SectionManagementPermission
from .serializers import SectionManagementSerializer, AssignSectionManagerSerializer, SectionSerializer
from .services import SectionManagementService


class SectionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer

    def get_queryset(self):
        # Only expose active sections via the API
        # Inactive sections are admin-only concern
        return Section.objects.filter(is_active=True)

class SectionManagementViewSet(viewsets.ModelViewSet):
    serializer_class = SectionManagementSerializer
    permission_classes = [SectionManagementPermission]

    def get_queryset(self):
        return Section.objects.select_related("manager").order_by("name")

    @action(detail=True, methods=["post"], url_path="assign-manager")
    def assign_manager(self, request, pk=None):
        section = self.get_object()

        serializer = AssignSectionManagerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        section = SectionManagementService.assign_manager(
            section=section,
            manager_id=serializer.validated_data["manager_id"],
        )

        output_serializer = self.get_serializer(section)

        return Response(output_serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        section = self.get_object()

        result = SectionManagementService.delete_or_deactivate(section)

        if result == "deactivated":
            return Response(
                {
                    "detail": "Section has related submissions, so it was deactivated instead of deleted."
                },
                status=status.HTTP_200_OK,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)