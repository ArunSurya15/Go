from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("buses", "0003_bus_service_and_ratings"),
    ]

    operations = [
        migrations.AddField(
            model_name="operator",
            name="kyc_checklist_json",
            field=models.TextField(blank=True, default="{}"),
        ),
        migrations.AddField(
            model_name="operator",
            name="kyc_internal_notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
