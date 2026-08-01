from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


urlpatterns = [
    # API documentation
    path(
        "schema/",
        SpectacularAPIView.as_view(),
        name="schema",
    ),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
        ),
        name="swagger-ui",
    ),
    path(
        "redoc/",
        SpectacularRedocView.as_view(
            url_name="schema",
        ),
        name="redoc",
    ),

    # Domain APIs
    path("auth/", include("apps.accounts.urls")),
    path("sections/", include("apps.journals.urls")),
    path("submissions/", include("apps.submissions.urls")),
    path("", include("apps.integrity.urls")),
    path("", include("apps.workflow.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.publishing.urls")),
]