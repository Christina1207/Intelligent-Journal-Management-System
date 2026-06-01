from django.urls import path
from apps.workflow import views

urlpatterns = [
    path("queue/", views.EditorQueueView.as_view(), name="editor-queue"),
]