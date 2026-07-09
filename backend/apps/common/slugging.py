from django.utils.text import slugify


def build_unique_slug(queryset, value, *, fallback, max_length, exclude_pk=None):
    base = slugify(value) or fallback
    base = base[:max_length]

    slug = base
    suffix = 2

    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)

    while queryset.filter(slug=slug).exists():
        suffix_text = f"-{suffix}"
        slug = f"{base[: max_length - len(suffix_text)]}{suffix_text}"
        suffix += 1

    return slug