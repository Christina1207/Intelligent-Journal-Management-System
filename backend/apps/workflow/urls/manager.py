from django.urls import path
from apps.workflow import views

urlpatterns = [
    path(
        "queue/",
        views.ManagerQueueView.as_view(),
        name="manager-queue",
    ),
    path(
        "submissions/<uuid:submission_id>/assign-editor/",
        views.AssignEditorView.as_view(),
        name="manager-assign-editor",
    ),
]