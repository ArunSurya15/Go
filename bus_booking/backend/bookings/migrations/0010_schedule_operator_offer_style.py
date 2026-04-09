from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0009_schedule_route_pattern"),
    ]

    operations = [
        migrations.AddField(
            model_name="schedule",
            name="operator_offer_style",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
    ]
