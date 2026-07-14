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
    path(
    "submissions/<uuid:submission_id>/triage/",
    views.TriageAssessmentView.as_view(),
    name="manager-submission-triage",
    ),
    path(
        "submissions/<uuid:submission_id>/triage/complete/",
        views.CompleteTriageView.as_view(),
        name="manager-submission-triage-complete",
    ),
    path(
        "submissions/<uuid:submission_id>/desk-reject/",
        views.DeskRejectSubmissionView.as_view(),
        name="manager-submission-desk-reject",
    ),
    path(
    "submissions/<uuid:submission_id>/reassign-editor/",
    views.ReassignEditorView.as_view(),
    name="manager-reassign-editor",
    ),
]