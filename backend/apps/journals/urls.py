from django.urls import path
from . import views

urlpatterns = [
    # TODO: add endpoints for creating/updating/deleting sections and assigning editors to sections
    path("", views.SectionListView.as_view(), name="section-list"),
]