from django.urls import path
from . import views

urlpatterns = [
    path("", views.SubmissionCreateView.as_view(), name="submission-create"),
    path("my/", views.MySubmissionsView.as_view(), name="submission-my-list"),
    path(
        "author-dashboard/",
        views.AuthorDashboardView.as_view(),
        name="submission-author-dashboard",
    ),
    path(
        "<uuid:submission_id>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail",
    ),
    path(
        "<uuid:submission_id>/versions/",
        views.SubmissionVersionListView.as_view(),
        name="submission-version-list",
    ),
    path(
        "<uuid:submission_id>/versions/upload/",
        views.RevisionUploadView.as_view(),
        name="submission-revision-upload",
    ),
]
