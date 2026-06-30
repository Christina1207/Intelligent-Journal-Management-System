from django.urls import path

from . import views


urlpatterns = [
    path(
        "publishing/submissions/<uuid:submission_id>/create-draft/",
        views.CreateArticleDraftView.as_view(),
        name="publishing-create-draft",
    ),
    path(
        "publishing/articles/",
        views.ArticleManagementListView.as_view(),
        name="publishing-article-list",
    ),
    path(
        "publishing/articles/<uuid:article_id>/",
        views.ArticleManagementDetailView.as_view(),
        name="publishing-article-detail",
    ),
    path(
        "publishing/articles/<uuid:article_id>/publish/",
        views.PublishArticleView.as_view(),
        name="publishing-article-publish",
    ),
    path(
        "public/articles/",
        views.PublicArticleListView.as_view(),
        name="public-article-list",
    ),
    path(
        "public/articles/<slug:slug>/",
        views.PublicArticleDetailView.as_view(),
        name="public-article-detail",
    ),
    path(
        "public/sections/<uuid:section_id>/articles/",
        views.PublicSectionArticleListView.as_view(),
        name="public-section-article-list",
    ),
]
