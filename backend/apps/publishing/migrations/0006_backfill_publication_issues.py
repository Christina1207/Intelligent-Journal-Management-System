from django.db import migrations
from django.utils import timezone
from django.utils.text import slugify


def build_unique_slug(model, base_value, *, max_length=280):
    base_slug = slugify(base_value) or "issue"
    base_slug = base_slug[:max_length]

    slug = base_slug
    suffix = 2

    while model.objects.filter(slug=slug).exists():
        suffix_text = f"-{suffix}"
        slug = f"{base_slug[: max_length - len(suffix_text)]}{suffix_text}"
        suffix += 1

    return slug


def build_issue_title(volume, number, year):
    parts = []

    if volume:
        parts.append(f"Volume {volume}")

    if number:
        parts.append(f"Issue {number}")

    parts.append(str(year))

    return ", ".join(parts)


def backfill_publication_issues(apps, schema_editor):
    Issue = apps.get_model("journals", "Issue")
    PublishedArticle = apps.get_model("publishing", "PublishedArticle")

    published_articles = (
        PublishedArticle.objects.filter(status="published")
        .exclude(volume="")
        .exclude(issue="")
        .filter(publication_issue__isnull=True)
        .order_by("published_at", "created_at")
    )

    for article in published_articles:
        published_at = article.published_at or article.created_at or timezone.now()
        year = published_at.year

        volume = article.volume.strip()
        number = article.issue.strip()

        issue = Issue.objects.filter(
            volume=volume,
            number=number,
            year=year,
        ).first()

        if issue is None:
            title = build_issue_title(volume, number, year)
            slug = build_unique_slug(
                Issue,
                f"vol-{volume}-issue-{number}-{year}",
                max_length=280,
            )

            issue = Issue.objects.create(
                title=title,
                slug=slug,
                volume=volume,
                number=number,
                year=year,
                status="published",
                published_at=published_at,
                is_current=False,
            )

        article.publication_issue = issue
        article.save(update_fields=["publication_issue"])


def reverse_backfill_publication_issues(apps, schema_editor):
    PublishedArticle = apps.get_model("publishing", "PublishedArticle")

    PublishedArticle.objects.filter(publication_issue__isnull=False).update(
        publication_issue=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("journals", "0006_backfill_section_slugs"),
        ("publishing", "0005_publishedarticle_publication_issue"),
    ]

    operations = [
        migrations.RunPython(
            backfill_publication_issues,
            reverse_backfill_publication_issues,
        ),
    ]