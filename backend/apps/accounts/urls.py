from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    path("register/", views.register_view, name="auth-register"),
    path("login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("me/", views.me_view, name="auth-me"),

    # Reviewer identity and profile management
    path("reviewer/profile/", views.reviewer_profile_update_view, name="reviewer-profile-update"),
    path("reviewer/profile/sync-orcid/", views.sync_orcid_view, name="reviewer-sync-orcid"),
]