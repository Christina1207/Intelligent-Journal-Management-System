from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path("register/", views.register_view, name="auth-register"),
    path("login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("me/", views.me_view, name="auth-me"),

    # Reviewer application — applicant operations
    path(
        "reviewer-application/",
        views.ReviewerApplicationView.as_view(),
        name="reviewer-application",
    ),

    # Reviewer application — Editor-in-Chief and administration
    path(
        "reviewer-applications/",
        views.ReviewerApplicationListView.as_view(),
        name="reviewer-application-list",
    ),
    path(
        "reviewer-applications/<uuid:application_id>/approve/",
        views.ReviewerApplicationApproveView.as_view(),
        name="reviewer-application-approve",
    ),
    path(
        "reviewer-applications/<uuid:application_id>/reject/",
        views.ReviewerApplicationRejectView.as_view(),
        name="reviewer-application-reject",
    ),

    # Reviewer identity and profile management
    path("reviewer/profile/", views.reviewer_profile_update_view, name="reviewer-profile-update"),
    path("reviewer/profile/sync-orcid/", views.sync_orcid_view, name="reviewer-sync-orcid"),
]