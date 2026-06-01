from django.urls import path
from apps.workflow import views

urlpatterns = [
    path("queue/", views.ManagerQueueView.as_view(), name="manager-queue"),
    path("assign-editor/", views.AssignEditorView.as_view(), name="manager-assign-editor"),
]