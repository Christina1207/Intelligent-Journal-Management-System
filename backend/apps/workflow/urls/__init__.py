from django.urls import include, path


urlpatterns = [
    path(
        "manager/",
        include("apps.workflow.urls.manager"),
    ),
    path(
        "editor/",
        include("apps.workflow.urls.editor"),
    ),
]