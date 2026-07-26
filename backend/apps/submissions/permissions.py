from django.db.models import Q

from apps.accounts.models import Role


def filter_submissions_for_user(queryset, user):
    """
    Scope submission querysets to records the user may view.

    Reviewer assignments intentionally do not grant access here; reviewer-facing
    manuscript access is handled by the review endpoints.
    """
    if not user or not user.is_authenticated:
        return queryset.none()

    role_names = set(user.roles.values_list("name", flat=True))

    if (
        user.is_superuser
        or Role.RoleName.EDITOR_IN_CHIEF in role_names
        or Role.RoleName.ADMIN in role_names
    ):
        return queryset

    access_filter = Q()

    if Role.RoleName.AUTHOR in role_names:
        access_filter |= Q(author=user)

    if Role.RoleName.SECTION_EDITOR in role_names:
        access_filter |= Q(assigned_editor=user)

    if Role.RoleName.SECTION_MANAGER in role_names:
        access_filter |= Q(section__manager=user)

    if not access_filter:
        return queryset.none()

    return queryset.filter(access_filter).distinct()
