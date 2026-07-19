from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.journals.views import SectionListView, SectionManagementViewSet


router = DefaultRouter()
router.register(
    r"manage/sections",
    SectionManagementViewSet,
    basename="section-management",
)

urlpatterns = [
    path("sections/", SectionListView.as_view(), name="section-list"),
    path("", include(router.urls)),
    path(
        "intelligence/",
        include("apps.journals.intelligence_urls"),
    ),
]