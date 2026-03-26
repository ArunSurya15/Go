from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("buses", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="bus",
            name="extras_note",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="bus",
            name="features_json",
            field=models.TextField(blank=True, default="[]"),
        ),
    ]
