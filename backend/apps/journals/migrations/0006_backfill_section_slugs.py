from django.db import migrations
from django.utils.text import slugify


def build_unique_slug(model, base_value, *, instance_id=None, max_length=280):
    base_slug = slugify(base_value) or "section"
    base_slug = base_slug[:max_length]

    slug = base_slug
    suffix = 2

    queryset = model.objects.all()
    if instance_id is not None:
        queryset = queryset.exclude(pk=instance_id)

    while queryset.filter(slug=slug).exists():
        suffix_text = f"-{suffix}"
        slug = f"{base_slug[: max_length - len(suffix_text)]}{suffix_text}"
        suffix += 1

    return slug


def backfill_section_slugs(apps, schema_editor):
    Section = apps.get_model("journals", "Section")

    for section in Section.objects.all().order_by("created_at", "name"):
        if section.slug:
            continue

        section.slug = build_unique_slug(
            Section,
            section.name,
            instance_id=section.pk,
            max_length=280,
        )
        section.save(update_fields=["slug"])


def reverse_backfill_section_slugs(apps, schema_editor):
    # Keep generated public slugs on rollback.
    # Public URLs may already depend on them.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("journals", "0005_journalmetadatasettings_access_policy_and_more"),
    ]

    operations = [
        migrations.RunPython(
            backfill_section_slugs,
            reverse_backfill_section_slugs,
        ),
    ]