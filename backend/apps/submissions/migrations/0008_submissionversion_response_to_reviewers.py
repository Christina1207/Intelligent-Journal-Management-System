from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("submissions", "0007_submissionversion_decision_letter"),
    ]

    operations = [
        migrations.AddField(
            model_name="submissionversion",
            name="response_to_reviewers",
            field=models.TextField(blank=True, default=""),
        ),
    ]
