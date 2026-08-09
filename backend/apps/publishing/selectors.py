from django.db.models import Q, Count
from apps.journals.models import Issue
from apps.accounts.models import Role

from .models import PublishedArticle


def publishing_records_for(user):
    """
    Return only publication records visible to the given editorial user.

    Section Editors see records for their assigned submissions.
    Section Managers see records belonging to their managed sections.
    Editors-in-Chief and Administrators have journal-wide access.
    """
    queryset = (
        PublishedArticle.objects.select_related(
            "section",
            "submission",
            "submission__assigned_editor",
        )
        .prefetch_related("authors")
    )

    if not user or not user.is_authenticated:
        return queryset.none()

    role_names = set(
        user.roles.values_list("name", flat=True)
    )

    if (
        user.is_superuser
        or Role.RoleName.EDITOR_IN_CHIEF in role_names
        or Role.RoleName.ADMIN in role_names
    ):
        return queryset

    scope = Q()

    if Role.RoleName.SECTION_MANAGER in role_names:
        scope |= Q(section__manager=user)

    if Role.RoleName.SECTION_EDITOR in role_names:
        scope |= Q(submission__assigned_editor=user)

    if not scope:
        return queryset.none()

    return queryset.filter(scope).distinct()

def issue_management_records():
    return (
        Issue.objects.annotate(
            article_count=Count("articles"),
            published_article_count=Count(
                "articles",
                filter=Q(
                    articles__status=PublishedArticle.Status.PUBLISHED,
                ),
            ),
            draft_article_count=Count(
                "articles",
                filter=Q(
                    articles__status=PublishedArticle.Status.DRAFT,
                ),
            ),
        )
        .order_by(
            "-is_current",
            "-year",
            "volume",
            "number",
        )
    )