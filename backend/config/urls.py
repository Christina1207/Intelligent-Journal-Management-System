from django.contrib import admin
from django.urls import path, include
from apps.reviews.urls import editor_urlpatterns, reviewer_urlpatterns

urlpatterns = [
    # TODO: unify url patterns
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/sections/", include("apps.journals.urls")),
    path("api/v1/submissions/", include("apps.submissions.urls")),
    path("api/v1/manager/", include("apps.workflow.urls.manager")),
    path("api/v1/editor/", include("apps.workflow.urls.editor")),

    path('api/v1/editor/', include((editor_urlpatterns, 'editor-reviews'))),
    path('api/v1/reviewer/', include((reviewer_urlpatterns, 'reviewer'))),
]
