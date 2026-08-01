from django.urls import path

from apps.integrity import views


urlpatterns = [
    path(
        (
            "manager/submissions/"
            "<uuid:submission_id>/"
            "plagiarism-screenings/"
        ),
        views.ManagerPlagiarismScreeningListCreateView.as_view(),
        name="manager-plagiarism-screening-list",
    ),
    path(
        (
            "manager/plagiarism-screenings/"
            "<uuid:screening_id>/"
        ),
        views.ManagerPlagiarismScreeningDetailView.as_view(),
        name="manager-plagiarism-screening-detail",
    ),
]