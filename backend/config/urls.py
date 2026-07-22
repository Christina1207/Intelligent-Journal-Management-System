from django.contrib import admin
from django.urls import include, path


urlpatterns = [
    # Project infrastructure
    path("admin/", admin.site.urls),

    # Versioned JSON REST API
    path("api/v1/", include("config.api_urls")),

    # OAI-PMH XML discovery protocol
    path("", include("apps.discovery.urls")),
]