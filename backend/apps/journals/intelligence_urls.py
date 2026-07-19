from django.urls import path

from .views import SectionTopicAnalyticsView


urlpatterns = [
    path(
        "topics/sections/",
        SectionTopicAnalyticsView.as_view(),
        name="section-topic-analytics",
    ),
]