from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.accounts.models import Role
from .models import Section
from .permissions import SectionManagementPermission
from .serializers import SectionManagementSerializer, AssignSectionManagerSerializer, SectionSerializer
from .services import SectionManagementService
from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from .permissions import CanViewTopicAnalytics
from .serializers import TopicAnalyticsDashboardSerializer
from .topic_analytics import TopicAnalyticsService

class SectionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SectionSerializer

    def get_queryset(self):
        # Only expose active sections via the API
        # Inactive sections are admin-only concern
        return Section.objects.filter(is_active=True)

class SectionManagementViewSet(viewsets.ModelViewSet):
    def get_serializer_class(self):
        if self.action == "assign_manager":
            return AssignSectionManagerSerializer

        return SectionManagementSerializer
    permission_classes = [SectionManagementPermission]

    def get_queryset(self):
        queryset = Section.objects.select_related("manager").order_by("name")
        user = self.request.user

        if not user or not user.is_authenticated:
            return queryset.none()

        if user.has_role(Role.RoleName.EDITOR_IN_CHIEF):
            return queryset

        if self.action == "list" and user.has_role(Role.RoleName.SECTION_MANAGER):
            return queryset.filter(manager=user)

        return queryset
    @extend_schema(
        request=AssignSectionManagerSerializer,
        responses=SectionManagementSerializer,
    )
    @action(detail=True, methods=["post"], url_path="manager")
    def assign_manager(self, request, pk=None):
        section = self.get_object()

        serializer = AssignSectionManagerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        section = SectionManagementService.assign_manager(
            section=section,
            manager=serializer.validated_data["manager"],
        )

        output_serializer = SectionManagementSerializer(
            section,
            context={"request": request},
        )

        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        section = self.get_object()
        section = SectionManagementService.deactivate(section)

        output_serializer = self.get_serializer(section)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        section = self.get_object()
        section = SectionManagementService.activate(section)

        output_serializer = self.get_serializer(section)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

# TODO: figure this out, either change to explicit mixins or let there be a hard delete
    def destroy(self, request, *args, **kwargs):
        section = self.get_object()
        section = SectionManagementService.deactivate(section)

        output_serializer = self.get_serializer(section)
        return Response(output_serializer.data, status=status.HTTP_200_OK)

class SectionTopicAnalyticsView(APIView):
    permission_classes = [
        IsAuthenticated,
        CanViewTopicAnalytics,
    ]

    @extend_schema(
        responses={
            200: TopicAnalyticsDashboardSerializer
        },
    )
    def get(self, request):
        dashboard = (
            TopicAnalyticsService.get_dashboard(
                request.user
            )
        )

        serializer = TopicAnalyticsDashboardSerializer(
            dashboard
        )

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )