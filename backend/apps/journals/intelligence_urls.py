from django.urls import path

from .views import (
    EditorialAnalyticsDashboardView,
    SectionTopicAnalyticsView,
)


urlpatterns = [
    path(
        "topics/sections/",
        SectionTopicAnalyticsView.as_view(),
        name="section-topic-analytics",
    ),
    path(
        "editorial-dashboard/",
        EditorialAnalyticsDashboardView.as_view(),
        name="editorial-analytics-dashboard",
    ),
]