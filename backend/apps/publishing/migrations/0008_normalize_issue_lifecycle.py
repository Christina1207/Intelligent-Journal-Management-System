from django.db import migrations
from django.db.models import F


def normalize_issue_lifecycle(apps, schema_editor):
    Issue = apps.get_model("journals", "Issue")

    published_issues = Issue.objects.filter(status="published")

    current_issue = published_issues.filter(
        is_current=True,
    ).first()

    if current_issue is None:
        current_issue = published_issues.order_by(
            F("published_at").desc(nulls_last=True),
            "-year",
            "-created_at",
        ).first()

    # Remove any invalid current marker from non-published issues.
    Issue.objects.filter(
        is_current=True,
    ).exclude(
        status="published",
    ).update(
        is_current=False,
    )

    if current_issue is None:
        return

    # Every older published issue becomes a closed archive.
    published_issues.exclude(
        pk=current_issue.pk,
    ).update(
        status="archived",
        is_current=False,
    )

    # Preserve or select exactly one open current issue.
    Issue.objects.filter(
        pk=current_issue.pk,
    ).update(
        status="published",
        is_current=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        (
            "publishing",
            "0007_store_pdf_as_minio_object_key",
        ),
    ]

    operations = [
        migrations.RunPython(
            normalize_issue_lifecycle,
            migrations.RunPython.noop,
        ),
    ]