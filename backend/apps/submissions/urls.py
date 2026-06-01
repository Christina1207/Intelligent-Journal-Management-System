from django.urls import path
from . import views

urlpatterns = [
    path("", views.SubmissionCreateView.as_view(), name="submission-create"),
    path("my/", views.MySubmissionsView.as_view(), name="submission-my-list"),
]