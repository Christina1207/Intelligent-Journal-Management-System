from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path("register/", views.register_view, name="auth-register"),
    path("login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("me/", views.me_view, name="auth-me"),

    # Reviewer profile
    # TODO: Move under /api/v1/reviewer/ prefix when reviewer-specific
    # URL namespace is created in Sprint 4.
    path("reviewer/profile/", views.reviewer_profile_update_view, name="reviewer-profile-update"),
    path("reviewer/profile/sync-orcid/", views.sync_orcid_view, name="reviewer-sync-orcid"),
]